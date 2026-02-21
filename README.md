# Hackathon - Frontend Project

## 📄 Sobre o Projeto
Este é o projeto de frontend desenvolvido para o Hackathon. A aplicação consiste em uma interface web baseada em HTML, CSS e JavaScript (Vanilla), estruturada de forma modular, com componentes para autenticação, consumo de APIs e exibição de vídeos. A aplicação é conteinerizada usando o servidor web Nginx e projetada para ser implantada em um cluster Kubernetes (Amazon EKS).

## 🚀 Tecnologias Utilizadas
- **Frontend:** HTML5, CSS3, JavaScript (ES6+ Vanilla), Modular ES Modules.
- **Servidor Web:** Nginx (imagem Alpine para leveza e performance).
- **Contêinerização:** Docker.
- **Orquestração e Deploy:** Kubernetes, Kustomize.
- **CI/CD:** GitHub Actions.
- **Nuvem:** Amazon Web Services (AWS - ECR para registro de contêineres e EKS para orquestração Kubernetes).

## 🔄 Esteira de CI/CD
A esteira de Integração Contínua e Entrega Contínua (CI/CD) foi construída utilizando **GitHub Actions**. O pipeline (definido em `.github/workflows/cicd.yml`) é ativado automaticamente a cada `push` na branch `main` ou de forma manual (`workflow_dispatch`).

**Passos do Pipeline:**
1. **Checkout:** Baixa o código mais recente do repositório.
2. **Configuração AWS:** Autentica na AWS usando as credenciais configuradas como secrets.
3. **Login no ECR:** Realiza o login seguro no Amazon Elastic Container Registry.
4. **Build e Push:** Constrói a imagem Docker da aplicação, aplicando uma tag única baseada no hash do commit (`github.sha`), e envia a versão para o ECR.
5. **Configuração do Kustomize:** Prepara a ferramenta Kustomize para gerenciar os manifestos do Kubernetes.
6. **Deploy no EKS:** Atualiza a imagem no manifesto pelo Kustomize, aplica as configurações no cluster EKS da AWS (no namespace `hack-frontend`) e aguarda a confirmação de que os pods subiram as novas versões com sucesso.

## 🛡️ Proteção da Branch `main`
Para garantir a estabilidade e qualidade do código em produção, a branch `main` conta com regras de proteção ativadas no GitHub. No contexto do projeto:
- O código da `main` reflete o estado atual de produção, sendo a nossa fonte de verdade.
- Commits diretos são restringidos, encorajando o uso de Pull Requests com revisões de código.
- Como a esteira de CI/CD assume que qualquer push na `main` deve ir para produção, a proteção evita que código quebrado seja compilado e afete os usuários finais.

## ✨ Boas Práticas Adotadas
Ao longo do projeto, procuramos seguir boas práticas de engenharia de software e DevOps:
- **Modularização de Código:** O código JavaScript foi refatorado e separado em diretórios como `utils` (ex: `api.js`, `auth.js`, `ui.js`) para uma clara separação de responsabilidades.
- **Imagens Docker Otimizadas:** Uso da versão Alpine do Nginx (`nginx:alpine`), que reduz a superfície de ataque e o tempo de download da imagem.
- **Versionamento Seguro de Imagens:** Tags geradas baseadas no hash de commit (`github.sha`) ao invés da tag genérica e mutável `latest`, o que permite fácil rastreabilidade e rollback.
- **Infraestrutura Declarativa:** Manipulação inteligente de manifestos Docker/Kubernetes utilizando o Kustomize.
- **Segurança de Branch:** Ativação de proteções na branch principal.

## 🔐 Secrets e Credenciais (AWS Academy)
Para que a automação da esteira funcione e interaja com a AWS, é necessário configurar as credenciais do ambiente de nuvem. Devido ao uso da plataforma **AWS Academy**, as credenciais são mantidas na sessão e de caráter **temporário**.

Os seguintes secrets devem estar configurados na aba *Settings > Secrets and variables > Actions* no repositório do GitHub:
- `AWS_ACCESS_KEY_ID`: Chave de acesso da AWS.
- `AWS_SECRET_ACCESS_KEY`: Chave secreta da AWS.
- `AWS_SESSION_TOKEN`: Token de sessão (frequentemente obrigatório em ambientes de IAM do Academy e Learner Labs que possuem limites de tempo por sessão).

> ⚠️ **Atenção:** Em caso de falhas de deploy ("ExpiredToken" ou similares), o erro muito provavelmente ocorre devido à expiração do tempo do Learner Lab. Você precisará gerar novos dados de `AWS Details` no AWS Academy e atualizar os valores desses secrets no GitHub.