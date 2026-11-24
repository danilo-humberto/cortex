import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type {
  EvaluationResult,
  PracticeChallenge,
  StudyItem,
  Topic,
} from "../shared/types.ts";

// Modelo rápido atual da família Gemini 4 (substitui o legado gemini-2.5-flash)
const DEFAULT_GEMINI_MODEL = "gemini-4-hydrogen";

const evaluationSchema = z.object({
  score: z.number().min(0).max(10).transform((n) => Math.round(n)),
  whatYouGotRight: z.array(z.string()).default([]),
  gapsOrMistakes: z.array(z.string()).default([]),
  followUpQuestion: z.string().min(1),
  suggestedConfidence: z.enum(["hard", "medium", "easy"]),
});

const challengeSchema = z.object({
  title: z.string().min(1),
  scenario: z.string().min(1),
  language: z.enum(["typescript", "javascript", "sql"]).default("typescript"),
  code: z.string().min(1),
  hint: z.string().min(1),
  solution: z.string().min(1),
});

function extractJsonText(rawText: string | null | undefined): string {
  if (!rawText) {
    throw new Error("A API do Gemini retornou uma resposta vazia.");
  }
  const trimmed = rawText.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  return trimmed;
}

export async function evaluateExplanationWithGemini(params: {
  apiKey: string;
  model?: string;
  topic: Topic;
  studyItem?: StudyItem;
  explanation: string;
}): Promise<EvaluationResult> {
  if (!params.apiKey) {
    throw new Error(
      "GEMINI_API_KEY não configurada. Adicione sua chave do Google AI Studio."
    );
  }

  const ai = new GoogleGenAI({ apiKey: params.apiKey });
  const model = params.model?.trim() || DEFAULT_GEMINI_MODEL;

  const isItemFocused = Boolean(params.studyItem);

  const systemInstruction = `Você é um engenheiro de software sênior avaliando a explicação de um desenvolvedor Júnior em transição para Pleno (foco em JavaScript, TypeScript e Fundamentos de Engenharia).
Seu método é a Técnica de Feynman + Recuperação Ativa: seja rigoroso porém acolhedor e didático, escrevendo sempre em Português do Brasil (PT-BR).

Regras de avaliação:
1. Não dê nota alta para respostas rasas, genéricas ou que apenas repetem o título.
2. Verifique se o estudante demonstrou compreensão real dos mecanismos por baixo dos panos (o "como" e o "porquê"), não só palavras-chave soltas.
${isItemFocused ? "3. IMPORTANTE: O estudante está explicando UM SUB-ITEM específico dentro de um tópico maior. Avalie rigorosamente apenas o escopo desse sub-item e NÃO desconte nota por não ter coberto outros itens do mesmo tópico." : "3. Avalie o domínio geral dos conceitos-chave do tópico."}
4. Em "whatYouGotRight", liste de 1 a 4 pontos concretos que o estudante acertou (se não acertou nada relevante, explique brevemente o esforço).
5. Em "gapsOrMistakes", liste de 1 a 4 lacunas conceituais, erros técnicos ou pontos que ficaram vagos dentro do escopo avaliado, explicando de forma direta como corrigir.
6. Em "followUpQuestion", faça exatamente 1 pergunta desafiadora e prática de entrevista/dia a dia de Pleno sobre esse ponto específico.
7. Em "suggestedConfidence":
   - "hard" se score <= 4 ou houve erros fundamentais;
   - "medium" se score entre 5 e 7 (entendeu a base, mas faltaram detalhes importantes);
   - "easy" se score >= 8 (explicação sólida, precisa e com domínio do assunto).`;

  const userPrompt = params.studyItem
    ? `Módulo: ${params.topic.moduleTitle}
Tópico pai: ${params.topic.title}
Sub-item avaliado: ${params.studyItem.title}
O que este sub-item deve cobrir: ${params.studyItem.prompt}

Explicação escrita pelo estudante para este sub-item (sem consulta):
"""
${params.explanation}
"""

Avalie a explicação focada exclusivamente neste sub-item e retorne o JSON estruturado no formato exigido.`
    : `Tópico avaliado: ${params.topic.title}
Módulo: ${params.topic.moduleTitle}
Resumo esperado: ${params.topic.summary}
Conceitos-chave do tópico: ${params.topic.keyConcepts.join(", ")}

Explicação escrita pelo estudante (sem consulta):
"""
${params.explanation}
"""

Avalie a explicação e retorne o JSON estruturado no formato exigido.`;

  const interaction = await ai.interactions.create({
    model,
    system_instruction: systemInstruction,
    input: userPrompt,
    store: false,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: {
        type: "object",
        properties: {
          score: {
            type: "integer",
            description: "Nota inteira de 0 a 10 para a compreensão demonstrada.",
          },
          whatYouGotRight: {
            type: "array",
            items: { type: "string" },
            description: "Lista de pontos técnicos corretos na explicação.",
          },
          gapsOrMistakes: {
            type: "array",
            items: { type: "string" },
            description:
              "Lista de lacunas, imprecisões ou erros técnicos encontrados.",
          },
          followUpQuestion: {
            type: "string",
            description:
              "Uma única pergunta desafiadora de nível Pleno para testar compreensão real.",
          },
          suggestedConfidence: {
            type: "string",
            enum: ["hard", "medium", "easy"],
            description:
              "Nível de confiança sugerido para a repetição espaçada.",
          },
        },
        required: [
          "score",
          "whatYouGotRight",
          "gapsOrMistakes",
          "followUpQuestion",
          "suggestedConfidence",
        ],
      },
    },
  });

  const jsonText = extractJsonText(interaction.output_text);
  const parsed = JSON.parse(jsonText);
  return evaluationSchema.parse(parsed);
}

export async function generatePracticeChallengeWithGemini(params: {
  apiKey: string;
  model?: string;
  topic: Topic;
}): Promise<PracticeChallenge> {
  if (!params.apiKey) {
    throw new Error(
      "GEMINI_API_KEY não configurada. Adicione sua chave do Google AI Studio."
    );
  }

  const ai = new GoogleGenAI({ apiKey: params.apiKey });
  const model = params.model?.trim() || DEFAULT_GEMINI_MODEL;

  const isSqlTopic =
    params.topic.moduleOrder === 4 &&
    (params.topic.id === "m4-t1" ||
      params.topic.id === "m4-t2" ||
      params.topic.id === "m4-t3");

  const systemInstruction = `Você cria mini-desafios práticos de "Caça ao Bug / Code Review" para um desenvolvedor Júnior em transição para Pleno (JS/TS e Backend).
Escreva em Português do Brasil (PT-BR).
O trecho de código deve ser curto (15 a 35 linhas), realista de produção e conter 1 ou 2 bugs sutis (ou falhas de performance/segurança) diretamente ligados ao tópico estudado.
NÃO coloque comentários no código entregando onde está o bug!`;

  const userPrompt = `Crie um desafio de Caça ao Bug / Code Review para o tópico:
- Título: ${params.topic.title}
- Resumo: ${params.topic.summary}
- Conceitos-chave: ${params.topic.keyConcepts.join(", ")}
- Prática sugerida: ${params.topic.suggestedPractice}
- Linguagem preferida: ${isSqlTopic ? "sql" : "typescript"}

Retorne o JSON estruturado com título, cenário do problema, código com o(s) bug(s), uma dica sem entregar tudo e a solução detalhada explicando os bugs e como corrigir.`;

  const interaction = await ai.interactions.create({
    model,
    system_instruction: systemInstruction,
    input: userPrompt,
    store: false,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título curto do desafio." },
          scenario: {
            type: "string",
            description: "Contexto breve e tarefa do usuário (2-3 frases).",
          },
          language: {
            type: "string",
            enum: ["typescript", "javascript", "sql"],
            description: "Linguagem do trecho de código.",
          },
          code: {
            type: "string",
            description: "Trecho de código curto com 1-2 bugs sutis, sem spoiler.",
          },
          hint: {
            type: "string",
            description: "Dica sutil que aponta a direção sem dar a resposta.",
          },
          solution: {
            type: "string",
            description:
              "Explicação clara do(s) bug(s) e da correção recomendada.",
          },
        },
        required: ["title", "scenario", "language", "code", "hint", "solution"],
      },
    },
  });

  const jsonText = extractJsonText(interaction.output_text);
  const parsed = JSON.parse(jsonText);
  return challengeSchema.parse(parsed);
}
