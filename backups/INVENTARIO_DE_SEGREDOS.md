# Inventário de segredos e configuração privada

Os valores abaixo **não** são guardados em ficheiros nem no histórico Git. Devem ser configurados como segredos no destino de recuperação.

| Variável | Finalidade | Proteção no GitHub |
| --- | --- | --- |
| `DATABASE_URL` | Ligação à base de dados de recuperação | Secret do repositório |
| `JWT_SECRET` | Assinatura de sessões locais | Secret do repositório |
| `GEMINI_API_KEY` | Leitura estruturada de faturas | Secret do repositório |
| `BREVO_API_KEY` | Alertas e resumo operacional por e-mail | Secret do repositório |
| `RESEND_API_KEY` | Configuração histórica de correio | Secret do repositório |
| `RESEND_FROM_EMAIL` | Remetente histórico de correio | Secret do repositório |
| `RESEND_HEAD_CHEF_EMAIL` | Destinatário histórico de correio | Secret do repositório |
| `OAUTH_SERVER_URL` | Autenticação Manus | Variável protegida do ambiente Manus |
| `VITE_APP_ID` | Identificador da aplicação | Variável protegida do ambiente Manus |
| `VITE_OAUTH_PORTAL_URL` | Portal de autenticação | Variável protegida do ambiente Manus |
| `VITE_FRONTEND_FORGE_API_KEY` | Acesso frontend a capacidades Manus | Variável protegida do ambiente Manus |
| `VITE_FRONTEND_FORGE_API_URL` | Endpoint de capacidades Manus | Variável protegida do ambiente Manus |
| `BUILT_IN_FORGE_API_KEY` | Acesso servidor a capacidades Manus | Variável protegida do ambiente Manus |
| `BUILT_IN_FORGE_API_URL` | Endpoint de capacidades Manus | Variável protegida do ambiente Manus |

> Os segredos externos configurados no GitHub destinam-se exclusivamente à recuperação administrada. Nunca os coloque em ficheiros `.env` enviados para o repositório ou em código fonte.
