# Avaliação de e-mail gratuito sem domínio próprio verificado

## Conclusões verificadas

| Plataforma | Pode enviar sem domínio próprio autenticado? | Limitação relevante | Adequação ao KB Kitchen |
|---|---|---|---|
| Brevo | Sim, como solução temporária; substitui o remetente por um endereço técnico próprio. | O destinatário não verá o remetente KB Kitchen e a própria Brevo recomenda autenticar o domínio para entrega sustentável. | Aceitável apenas como contingência temporária. |
| EmailJS + Gmail pessoal | Sim, através de uma conta Gmail ligada ao EmailJS. | Exige conta EmailJS, template e autorização da conta Gmail; a identidade do remetente será a conta Gmail. | Alternativa mais simples sem DNS para o baixo volume de alertas diários. |
| Resend | Não para envio profissional identificável; exige domínio verificado. | O domínio `cozinhakabuki.manus.space` está registado, mas os registos DNS necessários não podem ser criados pelo projeto. | Manter preparado para ativar quando houver domínio próprio verificável. |

## Recomendação provisória

Para alertas a dois destinatários e um resumo diário, utilizar **EmailJS ligado a uma conta Gmail exclusiva do KB Kitchen** é a alternativa prática sem DNS. A conta deve usar palavra-passe de aplicação ou OAuth, a origem deve ser restringida e os modelos devem ser definidos no painel EmailJS. Manter o canal de notificações internas como fonte principal de operação.

## Fontes

1. https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders
2. https://www.emailjs.com/
3. https://resend.com/docs/dashboard/domains/introduction
