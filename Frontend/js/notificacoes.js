const listaNotificacoesEl = document.getElementById("notifications-list");
const statusNotificacoesEl = document.getElementById("notifications-status");
let notificacoes = [];

document.getElementById("btn-logout").addEventListener("click", (event) => {
  event.preventDefault();
  localStorage.removeItem("token");
  window.location.href = "login.html";
});

function formatarDataHora(valor) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Data indisponível";
  return data.toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function renderizarNotificacoes(notificacoes) {
  listaNotificacoesEl.replaceChildren();
  statusNotificacoesEl.classList.remove("is-error");

  if (notificacoes.length === 0) {
    statusNotificacoesEl.textContent = "Nenhum agendamento de cliente foi recebido.";
    return;
  }

  statusNotificacoesEl.textContent = "";
  notificacoes.forEach((notificacao) => {
    const item = document.createElement("article");
    item.className = `notification-card${notificacao.lida ? "" : " is-unread"}`;

    const heading = document.createElement("div");
    heading.className = "notification-card-heading";
    const title = document.createElement("h2");
    title.textContent = notificacao.clienteNome || "Cliente";
    const state = document.createElement("span");
    state.className = "notification-state";
    state.textContent = notificacao.lida ? "Lida" : "Não lida";
    heading.append(title, state);

    const details = document.createElement("dl");
    details.className = "notification-details";
    const fields = [
      ["Data e horário", formatarDataHora(notificacao.dataHora)],
      ["Barbeiro", notificacao.barbeiroNome || "Não informado"],
      ["Serviços", notificacao.servicos?.join(", ") || "Não informado"],
      ["Status", notificacao.status || "Não informado"],
    ];
    fields.forEach(([label, value]) => {
      const wrapper = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = value;
      wrapper.append(term, description);
      details.appendChild(wrapper);
    });

    item.append(heading, details);
    if (!notificacao.lida) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "notification-read-button";
      button.textContent = "Marcar como lida";
      button.addEventListener("click", () => marcarComoLida(notificacao, button));
      item.appendChild(button);
    }

    listaNotificacoesEl.appendChild(item);
  });
}

async function marcarComoLida(notificacao, button) {
  button.disabled = true;
  try {
    const response = await apiFetch(
      `/api/agendamentos/${encodeURIComponent(notificacao.id)}/notificacao-lida`,
      { method: "PATCH" },
    );
    if (!response) return;
    if (!response.ok) {
      throw new Error(`Não foi possível atualizar a notificação (HTTP ${response.status}).`);
    }

    notificacao.lida = true;
    renderizarNotificacoes(notificacoes);
    await window.atualizarContagemNotificacoes?.();
  } catch (error) {
    button.disabled = false;
    statusNotificacoesEl.textContent = error.message;
    statusNotificacoesEl.classList.add("is-error");
  }
}

async function carregarNotificacoes() {
  try {
    const response = await apiFetch("/api/agendamentos/notificacoes");
    if (!response) return;
    if (!response.ok) {
      throw new Error(`Não foi possível carregar as notificações (HTTP ${response.status}).`);
    }

    const respostaNotificacoes = await response.json();
    if (!Array.isArray(respostaNotificacoes)) {
      throw new Error("A resposta de notificações está em um formato inválido.");
    }

    notificacoes = respostaNotificacoes;
    renderizarNotificacoes(notificacoes);
  } catch (error) {
    statusNotificacoesEl.textContent = error.message;
    statusNotificacoesEl.classList.add("is-error");
  }
}

carregarNotificacoes();
