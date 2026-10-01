# 🎵 Golphe JukeBox

> Jukebox corporativo e colaborativo em tempo real integrado ao Spotify, desenvolvido para equipes e eventos empresariais.

---

## 📌 Sobre o Projeto

O **Golphe JukeBox** permite que colaboradores adicionem músicas a uma fila compartilhada em tempo real diretamente de seus smartphones, enquanto uma tela principal (**Host**) reproduz as faixas com o **Spotify Web Playback SDK**.

O projeto conta com controle de spam por IP, autenticação corporativa restrita por domínio de e-mail, sincronização em tempo real e um **Piloto Automático (Fallback)** com playlist configurável, para que o som nunca pare quando a fila estiver vazia.

---

## ✨ Funcionalidades

### 📱 Convidados (`/`)
- **Login corporativo**: Google OAuth restrito a contas `@grupogolphe.com.br`.
- **Busca no Spotify**: pesquisa instantânea com capa, artista e duração.
- **Fila em tempo real**: ordem de reprodução com destaque para as faixas do próprio usuário.
- **Anti-spam**: até 3 músicas ativas por IP, com aviso de quantas faixas restam.

### 🖥️ Host / TV (`/host`)
- **Player Web nativo**: Spotify Web Playback SDK com transferência automática do dispositivo ativo.
- **Interface de telão**: capa grande, nome da faixa, artista e "Tocando Agora".
- **Pular faixa**: sincronizado com o banco de dados.
- **Piloto Automático**:
  - Toca faixas de uma playlist de backup quando a fila esvazia.
  - Playlist configurável no painel do Host.
  - Transições suaves, sem repetição e sem sobreposição de áudio.
- **Acesso restrito**: login administrativo do Host.

---

## 🛠️ Tecnologias

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS
- shadcn/ui + Radix UI
- Lucide Icons
- TanStack Query

### Backend (Lovable Cloud / Supabase)
- **PostgreSQL**: tabelas `queue` e `app_settings`.
- **Realtime**: atualização instantânea da fila em todos os dispositivos.
- **Edge Functions**:
  - `spotify-search` — busca segura de faixas.
  - `spotify-auth-url` / `spotify-token` / `spotify-refresh` — OAuth 2.0 do Spotify.
  - `queue-add` — validação de IP no servidor e anti-spam.
- **Row Level Security (RLS)**: proteção dos dados e ocultação de IPs.

---

## 🗂️ Rotas

| Rota | Descrição | Acesso |
|---|---|---|
| `/` | Interface mobile do convidado (busca e fila) | Google (@grupogolphe.com.br) |
| `/host` | Painel da TV, player e piloto automático | Login do Host |
| `*` | Página 404 | Público |

---

## 🚀 Como Executar Localmente

### 1. Pré-requisitos
- Node.js 18+ ou Bun
- Conta no [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- Projeto Lovable Cloud / Supabase configurado

### 2. Clonar o repositório
```bash
git clone https://github.com/seu-usuario/golphe-jukebox.git
cd golphe-jukebox
```

### 3. Instalar dependências
```bash
npm install
# ou
bun install
```

### 4. Variáveis de ambiente
Crie um arquivo `.env` na raiz:

```env
VITE_SUPABASE_URL="https://seu-projeto.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sua-chave-anon"
VITE_SUPABASE_PROJECT_ID="seu-project-id"
```

> **Atenção:** `SPOTIFY_CLIENT_ID` e `SPOTIFY_CLIENT_SECRET` devem ficar nos Secrets das Edge Functions, nunca no frontend.

### 5. Rodar
```bash
npm run dev
```
Acesse `http://localhost:8080`.

---

## 🎵 Configuração do Spotify

1. Crie um app no [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Em **Redirect URIs**, adicione:
   - `http://localhost:8080/host` (desenvolvimento)
   - `https://golphejukebox.lovable.app/host` (produção)
3. Em modo *Development*, adicione os usuários em **User Management**.
4. Escopos utilizados:
   - `streaming`
   - `user-read-email`
   - `user-read-private`
   - `user-modify-playback-state`
   - `user-read-playback-state`
   - `playlist-read-private`
   - `playlist-read-collaborative`

---

## 📄 Licença

Uso interno corporativo do **Grupo Golphe**. Todos os direitos reservados.
