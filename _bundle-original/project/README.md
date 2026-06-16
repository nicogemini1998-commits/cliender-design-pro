# Creative Infrastructure & Autonomous Supercomputer

Plataforma local de "Infraestructura Creativa y Supercomputación Autónoma" con dos modos:

- **Canvas Mode** — Lienzo infinito de nodos editables (React Flow).
- **Supercomputer Mode** — Chat inmersivo gobernado por un enjambre de 5 agentes (LangGraph).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js (App Router), TailwindCSS, shadcn/ui, React Flow, Framer Motion |
| Backend | Python 3.11+, FastAPI, LangGraph |
| Cerebro cognitivo | Anthropic Claude (única fuente de razonamiento) |
| Músculo creativo | Kid.ai (única fuente de generación visual) |

## Estructura del repo

```
.
├── frontend/                       # Next.js (App Router)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                # Landing / selector de modo
│   │   ├── canvas/
│   │   │   └── page.tsx            # Modo Canvas (React Flow)
│   │   └── chat/
│   │       └── page.tsx            # Modo Supercomputer
│   ├── components/
│   │   ├── ui/                     # shadcn/ui (button, dialog, ...)
│   │   ├── canvas/
│   │   │   ├── CanvasBoard.tsx
│   │   │   ├── nodes/              # Custom node components
│   │   │   │   ├── BaseNode.tsx
│   │   │   │   ├── AgentNode.tsx
│   │   │   │   ├── ImageNode.tsx
│   │   │   │   └── VideoNode.tsx
│   │   │   ├── edges/
│   │   │   │   └── AnimatedFlowEdge.tsx    # partículas / línea punteada
│   │   │   └── LedIndicator.tsx
│   │   ├── chat/
│   │   │   ├── ChatStream.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   └── ThinkingIndicator.tsx
│   │   └── shared/
│   │       ├── DotGridBackground.tsx
│   │       └── GlowCard.tsx
│   ├── lib/
│   │   ├── api.ts                  # cliente HTTP → backend
│   │   ├── stream.ts               # SSE/WebSocket
│   │   ├── store.ts                # Zustand
│   │   └── utils.ts
│   ├── hooks/
│   │   ├── useGraphStream.ts
│   │   └── useNodeStatus.ts
│   ├── styles/globals.css
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── next.config.mjs
│   └── package.json
│
├── backend/                        # FastAPI + LangGraph
│   ├── app/
│   │   ├── main.py                 # entrypoint FastAPI
│   │   ├── core/
│   │   │   ├── config.py           # settings, ALLOWED_KID_AI_MODELS
│   │   │   └── logging.py
│   │   ├── api/
│   │   │   ├── deps.py
│   │   │   └── routes/
│   │   │       ├── health.py
│   │   │       ├── canvas.py       # CRUD de grafos visuales (futuro)
│   │   │       └── supercomputer.py    # /chat, /chat/stream
│   │   ├── graph/                  # LangGraph
│   │   │   ├── state.py            # SwarmState (TypedDict)
│   │   │   ├── builder.py          # build_graph()
│   │   │   ├── routing.py          # edges condicionales
│   │   │   └── nodes/
│   │   │       ├── master_director.py
│   │   │       ├── scriptwriter.py
│   │   │       ├── cinematographer.py      # ← foco del Paso 1
│   │   │       ├── production.py
│   │   │       └── critic.py
│   │   ├── services/
│   │   │   ├── claude_client.py    # único cliente de razonamiento
│   │   │   └── kid_ai_client.py    # único cliente visual
│   │   ├── tools/
│   │   │   └── kid_ai_tool.py      # call_kid_ai_api (validador + dispatcher)
│   │   └── schemas/
│   │       ├── chat.py
│   │       └── jobs.py
│   ├── tests/
│   │   └── test_cinematographer.py
│   ├── pyproject.toml
│   └── .env.example
│
├── docker-compose.yml
└── README.md
```

## Próximos pasos

- **Paso 2** — Completar Scriptwriter, Production y Critic.
- **Paso 3** — Endpoints SSE para streaming del grafo.
- **Paso 4** — Frontend (cuando lo indiques).
