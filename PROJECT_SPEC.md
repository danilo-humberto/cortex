# Especificação do Projeto — Cortex (MVP)

## 1. Contexto e Objetivo
O usuário é desenvolvedor Júnior (2 anos de experiência, foco em JavaScript e TypeScript), terminando ADS, trabalhando sob alta pressão de entregas com uso intenso de IA. O objetivo deste projeto **não é estudar construindo o app**, mas sim **vibe codar um MVP enxuto e funcional rapidamente** para servir como ferramenta pessoal de estudos à noite, acessível de qualquer lugar.

**Regra de ouro de escopo:** Manter o MVP simples, rápido de subir e sem perfumaria desnecessária (evitar procrastinação produtiva).

---

## 2. Stack Tecnológica Definida
- **Deploy / Runtime:** Cloudflare Workers (com suporte a frontend + API no mesmo projeto, ex: React + Vite + Hono ou framework TypeScript compatível com Cloudflare Workers).
- **Banco de Dados:** NeonDB (PostgreSQL serverless), acessado via driver compatível com Cloudflare Workers (`@neondatabase/serverless` + Drizzle ORM ou SQL direto).
- **Validação de Explicações (IA):** API gratuita do Google Gemini (`@google/genai`, modelo rápido como `gemini-2.5-flash`).
- **Acesso Pessoal (Segurança mínima):** Como ficará público na internet, proteger o app com uma autenticação ultra simples de usuário único (ex: uma senha/PIN pessoal configurada em variável de ambiente `APP_ACCESS_KEY` + cookie `HttpOnly` assinado) para evitar que terceiros alterem dados ou gastem a cota da API do Gemini.

---

## 3. Regras Pedagógicas (Baseadas em Evidência)

O sistema deve incorporar 4 princípios comprovados pela ciência cognitiva:

1. **Tópicos Atômicos:**
   - Os 30 tópicos definidos em `data/roadmap.json` (5 módulos) são pequenos e independentes para evitar mistura de assuntos.
2. **Recuperação Ativa (Active Recall) + Técnica de Feynman + Validação por IA:**
   - Em cada tópico, o usuário escreve a explicação **com suas próprias palavras** (sem cola).
   - Ao clicar em **Validar com Gemini**, o backend chama a API do Gemini usando um prompt avaliador rigoroso e didático que retorna JSON estruturado:
     - `score` (0 a 10);
     - `whatYouGotRight` (pontos corretos);
     - `gapsOrMistakes` (o que faltou ou ficou confuso/errado);
     - `followUpQuestion` (1 pergunta desafiadora para testar compreensão real);
     - `suggestedConfidence` (`hard` | `medium` | `easy`).
3. **Repetição Espaçada (Spaced Repetition):**
   - Após estudar ou revisar um tópico, o usuário confirma seu nível de confiança e o sistema calcula a data de próxima revisão (`next_review_at`):
     - `hard` (Travei): +1 dia (reseta sequência)
     - `medium` (Razoável): +3 dias
     - `easy` (Firme): progressão `7d -> 15d -> 30d -> 60d` conforme o número de acertos seguidos (`streak`).
4. **Prática Intercalada (Interleaving) + Trava anti-bola de neve:**
   - Na tela inicial (**Estudo de Hoje**), exibir no máximo:
     - Até **2 revisões pendentes** (priorizando tópicos atrasados e alternando módulos quando possível);
     - **1 próximo tópico novo** da trilha linear.
   - Assim o usuário nunca enfrenta uma pilha assustadora de revisões acumuladas.
5. **Teoria + Prática (Contra o sedentarismo mental):**
   - Cada tópico possui dois estados de conclusão por ciclo:
     - Explicação validada;
     - Check de prática manual feita (`practice_done`: caça ao bug, leitura de código ou código escrito na mão sem autocompletar).
   - *Bônus opcional simples no MVP:* Botão **"Gerar Desafio Prático (Caça ao Bug / Code Review)"** na página do tópico que usa a API do Gemini para gerar um trecho curto de código JS/TS com 1-2 bugs sutis relacionados àquele tópico para o usuário analisar.

---

## 4. Modelo de Dados Sugerido (PostgreSQL / NeonDB)

### Tabela `topics`
Populada inicialmente via seed a partir de `data/roadmap.json`:
- `id` (TEXT PK, ex: `m1-t1`)
- `module_order` (INT)
- `module_title` (TEXT)
- `topic_order` (INT)
- `title` (TEXT)
- `summary` (TEXT)
- `key_concepts` (JSONB - array de strings)
- `suggested_practice` (TEXT)
- `status` (TEXT: `not_started` | `learning` | `reviewing` | `mastered`)
- `streak` (INT, default 0)
- `interval_days` (INT, default 0)
- `next_review_at` (TIMESTAMP NULL)
- `practice_done` (BOOLEAN, default false)
- `last_score` (INT NULL)
- `updated_at` (TIMESTAMP)

### Tabela `attempts` (Histórico de Explicações e Validações)
Serve como o "Caderno de Erros e Descobertas" automático:
- `id` (SERIAL ou UUID PK)
- `topic_id` (TEXT FK -> `topics.id`)
- `user_explanation` (TEXT)
- `ai_score` (INT)
- `ai_feedback` (JSONB: `{ whatYouGotRight, gapsOrMistakes, followUpQuestion }`)
- `confidence` (TEXT: `hard` | `medium` | `easy`)
- `created_at` (TIMESTAMP)

---

## 5. Telas do MVP (Apenas o Essencial)

1. **Login Simples (`/login`):** Campo único de senha pessoal (`APP_ACCESS_KEY`) para liberar acesso.
2. **Hoje (`/`) — Dashboard Focado:**
   - Progresso geral (ex: `X / 30 tópicos iniciados`, revisões em dia).
   - Bloco **"Estudo de Hoje"**: até 2 revisões pendentes + 1 tópico novo sugerido.
3. **Trilha Completa (`/trilha`):**
   - Lista dos 5 módulos com seus 30 tópicos, badges de status, nota anterior e data da próxima revisão.
4. **Sala de Estudo do Tópico (`/topico/:id`):**
   - Título, resumo curto, conceitos-chave (escondíveis por padrão durante a escrita para forçar Active Recall!).
   - Área de texto para escrever a explicação com as próprias palavras + botão **Validar com Gemini**.
   - Exibição estruturada do feedback da IA + botões de confiança (**Travei [1d]** / **Razoável [3d]** / **Firme [7d+]**) que agendam a próxima revisão.
   - Checkbox **"Fiz a prática manual"** + sugestão de exercício (e botão opcional para gerar desafio de código com Gemini).
   - Histórico das tentativas anteriores daquele tópico.

---

## 6. Variáveis de Ambiente Necessárias
- `DATABASE_URL`: String de conexão do NeonDB PostgreSQL.
- `GEMINI_API_KEY`: Chave gratuita da API do Google Gemini (AI Studio).
- `APP_ACCESS_KEY`: Senha pessoal simples para proteger o acesso ao app.
- `SESSION_SECRET`: String aleatória para assinar o cookie de sessão.

---

## 7. Referências Pedagógicas e Técnicas
- *roadmap.sh* (Backend, JavaScript, TypeScript, System Design)
- *The Pragmatic Engineer* (transição Júnior → Pleno)
- *Anthropic Skill Formation Study* (Shen & Tamkin) & literatura sobre *Cognitive Offloading*
- *Dunlosky et al.*, *MIT*, *RetrievalPractice.org* (Active Recall, Spaced Repetition, Interleaving, Desirable Difficulty)
