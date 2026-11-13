const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const DIAS_SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const hoje = new Date();
let anoAtual = hoje.getFullYear();
let mesAtual = hoje.getMonth();
let diaSelecionado = hoje.getDate();

let agendamentosDoMes = [];
let servicosDisponiveis = [];
let barbeirosDisponiveis = [];
let bloqueios = [];
let funcionamento = {
  horarioAbertura: "08:00",
  horarioEncerramento: "20:00",
  diasFuncionamento: [1, 2, 3, 4, 5, 6, 7],
};

const calendarioEl = document.getElementById("calendario");
const mesTituloEl = document.getElementById("mes-titulo");
const totalMesEl = document.getElementById("total-mes");
const diaSelecionadoLabelEl = document.getElementById("dia-selecionado-label");
const agendaDiaTituloEl = document.getElementById("agenda-dia-titulo");
const agendaListaEl = document.getElementById("agenda-lista");
const servicosOpcoesEl = document.getElementById("servicos-opcoes");
const horarioSelect = document.getElementById("horario");
const formNovoAgendamento = document.getElementById("form-novo-agendamento");
const profileNameEl = document.getElementById("profile-name");
const barbeiroAgendaEl = document.getElementById("barbeiro-agenda");
const modalEdicaoEl = document.getElementById("modal-edicao");
const formEdicaoEl = document.getElementById("form-edicao-agendamento");
const edicaoClienteNomeEl = document.getElementById("edicao-cliente-nome");
const edicaoServicosOpcoesEl = document.getElementById(
  "edicao-servicos-opcoes",
);
const edicaoDataHoraEl = document.getElementById("edicao-data-hora");
let agendamentoEmEdicao = null;
const modalConclusaoEl = document.getElementById("modal-conclusao");
const formConclusaoEl = document.getElementById("form-conclusao");
const conclusaoFormaPagamentoEl = document.getElementById(
  "conclusao-forma-pagamento",
);
const conclusaoFeedbackEl = document.getElementById("conclusao-feedback");
const botaoConfirmarConclusaoEl = document.getElementById(
  "btn-confirmar-conclusao",
);
let alteracaoStatusPendente = null;

// Elementos de Bloqueio de Horário
const formBloqueioEl = document.getElementById("form-bloqueio");
const bloqueioInicioEl = document.getElementById("bloqueio-inicio");
const bloqueioFimEl = document.getElementById("bloqueio-fim");
const bloqueiosListaEl = document.getElementById("bloqueios-lista");

function decodeJwtPayload(token) {
  try {
    const payloadBase64 = token.split(".")[1];
    const payloadJson = atob(
      payloadBase64.replace(/-/g, "+").replace(/_/g, "/"),
    );
    return JSON.parse(payloadJson);
  } catch (e) {
    return null;
  }
}

async function identificarUsuarioLogado() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const payload = decodeJwtPayload(token);
  if (!payload || !payload.sub) return;

  const resp = await apiFetch("/api/usuarios");
  if (!resp) return;

  const usuarios = await resp.json();
  const usuarioLogado = usuarios.find((u) => u.email === payload.sub);

  if (usuarioLogado && profileNameEl) {
    profileNameEl.textContent =
      usuarioLogado.nomeBarbearia || usuarioLogado.nome;
  }
}

function formatarData(dia, mes, ano) {
  const dd = String(dia).padStart(2, "0");
  const mm = String(mes + 1).padStart(2, "0");
  return `${dd}/${mm}/${ano}`;
}

function formatarTelefone(valor) {
  const d = String(valor || "").replace(/\D/g, "");
  if (d.length === 11)
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(valor || "");
}

function ehDiaAnterior(dia, mes, ano) {
  const dataSelecionada = new Date(ano, mes, dia);
  const inicioDeHoje = new Date();
  inicioDeHoje.setHours(0, 0, 0, 0);
  return dataSelecionada < inicioDeHoje;
}

function numeroDiaFuncionamento(dia, mes, ano) {
  const diaSemana = new Date(ano, mes, dia).getDay();
  return diaSemana === 0 ? 7 : diaSemana;
}

function diaAtende(dia, mes, ano) {
  return funcionamento.diasFuncionamento.includes(numeroDiaFuncionamento(dia, mes, ano));
}

function horarioPermitido(data, hora, duracao) {
  const [ano, mes, dia] = data.split("-").map(Number);
  const numeroDia = numeroDiaFuncionamento(dia, mes - 1, ano);
  const [horaInicio, minutoInicio] = hora.split(":").map(Number);
  const [horaAbertura, minutoAbertura] = funcionamento.horarioAbertura.split(":").map(Number);
  const [horaEncerramento, minutoEncerramento] = funcionamento.horarioEncerramento.split(":").map(Number);
  const inicio = horaInicio * 60 + minutoInicio;
  const abertura = horaAbertura * 60 + minutoAbertura;
  const encerramento = horaEncerramento * 60 + minutoEncerramento;
  return funcionamento.diasFuncionamento.includes(numeroDia)
    && inicio >= abertura
    && inicio + duracao <= encerramento;
}

async function carregarFuncionamento() {
  const resposta = await apiFetch("/api/barbearia");
  if (!resposta) return;
  if (!resposta.ok) throw new Error("Não foi possível carregar o horário da barbearia.");
  const dados = await resposta.json();
  funcionamento = {
    horarioAbertura: dados.horarioAbertura.slice(0, 5),
    horarioEncerramento: dados.horarioEncerramento.slice(0, 5),
    diasFuncionamento: dados.diasFuncionamento,
  };
}

function atualizarDisponibilidadeDoFormulario() {
  const diaAnterior = ehDiaAnterior(diaSelecionado, mesAtual, anoAtual);
  const fechado = !diaAtende(diaSelecionado, mesAtual, anoAtual);
  const todasAgendas = barbeiroAgendaEl.value === "todos";
  const controles = formNovoAgendamento.querySelectorAll(
    "input, select, button",
  );

  controles.forEach((controle) => {
    controle.disabled = diaAnterior || fechado || todasAgendas;
  });

  formNovoAgendamento.classList.toggle("dia-anterior", diaAnterior);
  formNovoAgendamento.classList.toggle("dia-fechado", fechado);
  formNovoAgendamento.classList.toggle("todas-agendas", todasAgendas);
}

function horarioJaPassou(valor) {
  const [h, m] = valor.split(":").map(Number);
  return new Date(anoAtual, mesAtual, diaSelecionado, h, m) <= new Date();
}

function horarioBloqueado(valor) {
  const [h, m] = valor.split(":").map(Number);
  const momento = new Date(anoAtual, mesAtual, diaSelecionado, h, m);
  return bloqueios.some((b) => momento >= new Date(b.inicio) && momento < new Date(b.fim));
}

function gerarHorarios() {
  horarioSelect.innerHTML = "";
  const todosAgendas = barbeiroAgendaEl.value === "todos";
  if (!diaAtende(diaSelecionado, mesAtual, anoAtual) || todosAgendas) {
    horarioSelect.add(new Option(
      todosAgendas ? "Selecione um barbeiro para criar horário" : "Barbearia fechada neste dia",
      "",
    ));
    horarioSelect.disabled = true;
    return;
  }

  const duracao = servicosSelecionados(servicosOpcoesEl, "novo-servico")
    .reduce((total, id) => {
      const servico = servicosDisponiveis.find((item) => Number(item.id) === id);
      return total + (Number(servico?.duracaoMinutos) || 0);
    }, 0);
  const [aberturaHora, aberturaMinuto] = funcionamento.horarioAbertura.split(":").map(Number);
  const [fechamentoHora, fechamentoMinuto] = funcionamento.horarioEncerramento.split(":").map(Number);
  const abertura = aberturaHora * 60 + aberturaMinuto;
  const fechamento = fechamentoHora * 60 + fechamentoMinuto;
  let quantidade = 0;

  for (let minuto = abertura; minuto + duracao <= fechamento; minuto += 30) {
    const valor = `${String(Math.floor(minuto / 60)).padStart(2, "0")}:${String(minuto % 60).padStart(2, "0")}`;
    if (horarioJaPassou(valor) || horarioBloqueado(valor)) continue;
    horarioSelect.add(new Option(valor, valor));
    quantidade += 1;
  }
  if (!quantidade) horarioSelect.add(new Option("Não há horários disponíveis neste dia", ""));
  horarioSelect.disabled = quantidade === 0;
}

function renderizarOpcoesServicos(container, name, selecionados = []) {
  const idsSelecionados = new Set(selecionados.map(String));
  container.innerHTML = servicosDisponiveis
    .map(
      (servico) => `
    <label class="servico-opcao">
      <input type="checkbox" name="${name}" value="${servico.id}" ${idsSelecionados.has(String(servico.id)) ? "checked" : ""} />
      <span>${escaparHtml(servico.nome)}</span>
    </label>
  `,
    )
    .join("");
}

function servicosDoAgendamento(agendamento) {
  if (agendamento.servicos?.length) return agendamento.servicos;
  return agendamento.servico ? [agendamento.servico] : [];
}

function servicosSelecionados(container, name) {
  return Array.from(
    container.querySelectorAll(`input[name="${name}"]:checked`),
  ).map((checkbox) => Number(checkbox.value));
}

function popularHorariosBloqueio() {
  if (!bloqueioInicioEl || !bloqueioFimEl) return;
  const opcoes = [];
  const paraMinutos = (hora) => {
    const [h, m] = hora.split(":").map(Number);
    return h * 60 + m;
  };
  const paraHora = (minutos) =>
    `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
  const abertura = paraMinutos(funcionamento.horarioAbertura);
  const encerramento = paraMinutos(funcionamento.horarioEncerramento);
  for (let minutos = abertura; minutos < encerramento; minutos += 30) {
    const valor = paraHora(minutos);
    opcoes.push(`<option value="${valor}">${valor}</option>`);
  }
  const fechamento = paraHora(encerramento);
  if (opcoes.length === 0 || !opcoes.some((opcao) => opcao.includes(`value="${fechamento}"`))) {
    opcoes.push(`<option value="${fechamento}">${fechamento}</option>`);
  }
  bloqueioInicioEl.innerHTML = opcoes.join("");
  bloqueioFimEl.innerHTML = opcoes.join("");
  bloqueioFimEl.selectedIndex = 1;
}

async function carregarBloqueios() {
  if (barbeiroAgendaEl.value === "todos") {
    bloqueios = [];
    return;
  }
  const resp = await apiFetch(`/api/bloqueios?barbeiroId=${encodeURIComponent(barbeiroAgendaEl.value)}`);
  bloqueios = resp && resp.ok ? await resp.json() : [];
}

function renderizarBloqueios() {
  if (!bloqueiosListaEl) return;
  if (barbeiroAgendaEl.value === "todos") {
    bloqueiosListaEl.innerHTML = '<p class="agenda-vazia">Selecione um barbeiro para ver ou criar bloqueios.</p>';
    return;
  }
  const doDia = bloqueios.filter((b) => {
    const inicio = new Date(b.inicio);
    return (inicio.getFullYear() === anoAtual && inicio.getMonth() === mesAtual && inicio.getDate() === diaSelecionado);
  }).sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

  if (!doDia.length) {
    bloqueiosListaEl.innerHTML = '<p class="agenda-vazia">Nenhum horário bloqueado neste dia.</p>';
    return;
  }

  const hora = (valor) => new Date(valor).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  bloqueiosListaEl.innerHTML = doDia.map((b) => `
        <div class="agenda-item">
            <div><span class="horario">${hora(b.inicio)} – ${hora(b.fim)}</span>Indisponível</div>
            <button type="button" class="btn-acao-agendamento btn-excluir-agendamento" data-remover-bloqueio="${b.id}">Remover</button>
        </div>
    `).join("");
}

if (bloqueiosListaEl) {
  bloqueiosListaEl.addEventListener("click", async (event) => {
    const botao = event.target.closest("[data-remover-bloqueio]");
    if (!botao) return;
    const resp = await apiFetch(`/api/bloqueios/${botao.dataset.removerBloqueio}`, { method: "DELETE" });
    if (!resp || !resp.ok) {
      alert("Não foi possível remover o bloqueio.");
      return;
    }
    await carregarBloqueios();
    atualizarPainelDoDia();
  });
}

if (formBloqueioEl) {
  formBloqueioEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (barbeiroAgendaEl.value === "todos") {
      alert("Selecione um barbeiro específico para bloquear horários.");
      return;
    }
    if (ehDiaAnterior(diaSelecionado, mesAtual, anoAtual)) {
      alert("Não é possível bloquear um dia que já passou.");
      return;
    }
    if (!diaAtende(diaSelecionado, mesAtual, anoAtual)) {
      alert("A barbearia não atende neste dia.");
      return;
    }
    if (bloqueioFimEl.value <= bloqueioInicioEl.value) {
      alert("O horário final deve ser depois do inicial.");
      return;
    }

    const dia = `${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}-${String(diaSelecionado).padStart(2, "0")}`;
    const resp = await apiFetch("/api/bloqueios", {
      method: "POST",
      body: JSON.stringify({
        barbeiro: { id: Number(barbeiroAgendaEl.value) },
        inicio: `${dia}T${bloqueioInicioEl.value}:00`,
        fim: `${dia}T${bloqueioFimEl.value}:00`,
      }),
    });

    if (!resp || !resp.ok) {
      const erro = resp ? await resp.json().catch(() => ({})) : {};
      alert(erro.erro || "Não foi possível bloquear o horário.");
      return;
    }
    await carregarBloqueios();
    atualizarPainelDoDia();
  });
}

async function carregarServicosEBarbeiros() {
  const respBarbeiros = await apiFetch("/api/barbeiros");
  if (!respBarbeiros || !respBarbeiros.ok) {
    barbeiroAgendaEl.innerHTML =
      '<option value="">Não foi possível carregar os barbeiros</option>';
    return;
  }
  barbeirosDisponiveis = await respBarbeiros.json();
  barbeiroAgendaEl.innerHTML = [
    '<option value="todos">Todas as agendas</option>',
    ...barbeirosDisponiveis.map(
      (barbeiro) =>
        `<option value="${barbeiro.id}">${escaparHtml(barbeiro.nome)}</option>`,
    ),
  ].join("");
  if (!barbeirosDisponiveis.length) {
    barbeiroAgendaEl.innerHTML =
      '<option value="todos">Todas as agendas</option>';
  }

  const usuarioLogado = await Permissoes.usuario();
  if (!Permissoes.ehAdmin(usuarioLogado) && usuarioLogado.barbeiroId) {
    barbeiroAgendaEl.innerHTML = `<option value="${usuarioLogado.barbeiroId}">${escaparHtml(usuarioLogado.nome)}</option>`;
    barbeiroAgendaEl.disabled = true;
  }

  const respServicos = await apiFetch("/api/servicos");
  if (!respServicos || !respServicos.ok) return;

  servicosDisponiveis = await respServicos.json();

  renderizarOpcoesServicos(servicosOpcoesEl, "novo-servico");
}

async function carregarAgendamentosDoMes() {
  const query =
    barbeiroAgendaEl.value === "todos"
      ? ""
      : `?barbeiroId=${encodeURIComponent(barbeiroAgendaEl.value)}`;
  const resp = await apiFetch(`/api/agendamentos${query}`);
  if (!resp) return;

  const todos = await resp.json();

  agendamentosDoMes = todos.filter((a) => {
    const data = new Date(a.dataHora);
    return data.getFullYear() === anoAtual && data.getMonth() === mesAtual;
  });

  totalMesEl.textContent = `${agendamentosDoMes.length} agendamento${agendamentosDoMes.length === 1 ? "" : "s"} no mês`;
}

function renderizarCalendario() {
  mesTituloEl.textContent = `${MESES[mesAtual]} ${anoAtual}`;
  calendarioEl.innerHTML = "";

  DIAS_SEMANA.forEach((d) => {
    const el = document.createElement("div");
    el.className = "day-name";
    el.textContent = d;
    calendarioEl.appendChild(el);
  });

  const primeiroDiaSemana = new Date(anoAtual, mesAtual, 1).getDay();
  const totalDias = new Date(anoAtual, mesAtual + 1, 0).getDate();

  for (let i = 0; i < primeiroDiaSemana; i++) {
    const vazio = document.createElement("div");
    vazio.className = "day-cell empty";
    calendarioEl.appendChild(vazio);
  }

  const contagemPorDia = new Map();
  agendamentosDoMes.forEach((a) => {
    const dia = new Date(a.dataHora).getDate();
    contagemPorDia.set(dia, (contagemPorDia.get(dia) || 0) + 1);
  });

  for (let dia = 1; dia <= totalDias; dia++) {
    const cell = document.createElement("div");
    cell.className = "day-cell";
    cell.textContent = dia;

    const diaAnterior = ehDiaAnterior(dia, mesAtual, anoAtual);
    if (diaAnterior) cell.classList.add("past");
    if (!diaAtende(dia, mesAtual, anoAtual)) {
      cell.classList.add("closed-day");
      cell.title = "Barbearia fechada para novos atendimentos";
    }

    if (dia === diaSelecionado) cell.classList.add("selected");

    const quantidade = contagemPorDia.get(dia);
    if (quantidade) {
      const badge = document.createElement("span");
      badge.className = "day-badge";
      badge.textContent = quantidade;
      cell.appendChild(badge);
    }

    cell.addEventListener("click", () => selecionarDia(dia));
    calendarioEl.appendChild(cell);
  }
}

function selecionarDia(dia) {
  diaSelecionado = dia;
  renderizarCalendario();
  atualizarPainelDoDia();
}

function atualizarPainelDoDia() {
  atualizarDisponibilidadeDoFormulario();
  gerarHorarios();
  renderizarBloqueios();

  const dataFormatada = formatarData(diaSelecionado, mesAtual, anoAtual);
  const diaFechado = !diaAtende(diaSelecionado, mesAtual, anoAtual);
  diaSelecionadoLabelEl.textContent = `Dia ${dataFormatada}${diaFechado ? " · Fechado" : ""}`;
  agendaDiaTituloEl.textContent = `Agenda do dia ${String(diaSelecionado).padStart(2, "0")}/${String(mesAtual + 1).padStart(2, "0")}`;

  const doDia = agendamentosDoMes
    .filter((a) => new Date(a.dataHora).getDate() === diaSelecionado)
    .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));

  if (doDia.length === 0) {
    agendaListaEl.innerHTML = `<p class="agenda-vazia">Nenhum horário agendado para este dia.</p>`;
    return;
  }

  agendaListaEl.innerHTML = doDia
    .map((a) => {
      const hora = new Date(a.dataHora).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const status = a.status || "AGENDADO";
      const servico =
        servicosDoAgendamento(a)
          .map((item) => escaparHtml(item.nome))
          .join(", ") || "Serviço não informado";
      const barbeiro =
        barbeiroAgendaEl.value === "todos" && a.barbeiro
          ? `<div class="agenda-item-detalhes">Barbeiro: ${escaparHtml(a.barbeiro.nome)}</div>`
          : "";
      const telefone = a.clienteTelefone
        ? ` • ${escaparHtml(formatarTelefone(a.clienteTelefone))}`
        : "";
      return `
        <div class="agenda-item">
          <div class="agenda-item-conteudo">
            <div><span class="horario">${hora}</span><span class="agenda-item-nome">${escaparHtml(a.clienteNome)}</span></div>
            ${barbeiro}
            <div class="agenda-item-detalhes">${escaparHtml(servico)}${telefone}</div>
          </div>
          <div class="agenda-item-acoes">
            <select class="status-select" data-status-id="${a.id}" aria-label="Status do agendamento">
              ${["AGENDADO", "CONCLUIDO", "CANCELADO"].map((opcao) => `<option value="${opcao}" ${status === opcao ? "selected" : ""}>${opcao}</option>`).join("")}
            </select>
            <button type="button" class="btn-acao-agendamento" data-editar-id="${a.id}">Editar</button>
            <button type="button" class="btn-acao-agendamento btn-excluir-agendamento" data-excluir-id="${a.id}">Excluir</button>
          </div>
        </div>
      `;
    })
    .join("");

  agendaListaEl.querySelectorAll("[data-status-id]").forEach((select) => {
    select.addEventListener("change", () => {
      const agendamento = agendamentosDoMes.find(
        (item) => String(item.id) === String(select.dataset.statusId),
      );
      const statusAnterior = agendamento?.status || "AGENDADO";
      if (select.value === "CONCLUIDO" && statusAnterior !== "CONCLUIDO") {
        abrirModalConclusao(select, statusAnterior);
        return;
      }
      alterarStatus(
        select.dataset.statusId,
        select.value,
        statusAnterior,
        select,
      );
    });
  });
  agendaListaEl.querySelectorAll("[data-editar-id]").forEach((botao) => {
    botao.addEventListener("click", () => abrirEdicao(botao.dataset.editarId));
  });
  agendaListaEl.querySelectorAll("[data-excluir-id]").forEach((botao) => {
    botao.addEventListener("click", () =>
      excluirAgendamento(botao.dataset.excluirId),
    );
  });
}

function preencherOpcoesEdicao(selecionados) {
  renderizarOpcoesServicos(
    edicaoServicosOpcoesEl,
    "edicao-servico",
    selecionados,
  );
}

function abrirEdicao(id) {
  agendamentoEmEdicao = agendamentosDoMes.find(
    (a) => String(a.id) === String(id),
  );
  if (!agendamentoEmEdicao) return;

  preencherOpcoesEdicao(
    servicosDoAgendamento(agendamentoEmEdicao).map((servico) => servico.id),
  );
  edicaoClienteNomeEl.value = agendamentoEmEdicao.clienteNome || "";
  edicaoDataHoraEl.value = agendamentoEmEdicao.dataHora.slice(0, 16);
  modalEdicaoEl.style.display = "flex";
}

function fecharEdicao() {
  modalEdicaoEl.style.display = "none";
  agendamentoEmEdicao = null;
}

function abrirModalConclusao(select, statusAnterior) {
  alteracaoStatusPendente = {
    id: select.dataset.statusId,
    select,
    statusAnterior,
  };
  conclusaoFeedbackEl.textContent = "";
  conclusaoFormaPagamentoEl.value = "";
  modalConclusaoEl.style.display = "flex";
  conclusaoFormaPagamentoEl.focus();
}

function fecharModalConclusao(restaurarStatus = true) {
  if (restaurarStatus && alteracaoStatusPendente) {
    alteracaoStatusPendente.select.value =
      alteracaoStatusPendente.statusAnterior;
  }
  modalConclusaoEl.style.display = "none";
  alteracaoStatusPendente = null;
  formConclusaoEl.reset();
  conclusaoFeedbackEl.textContent = "";
}

async function alterarStatus(
  id,
  status,
  statusAnterior,
  select,
  formaPagamento = null,
) {
  const resp = await apiFetch(`/api/agendamentos/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, formaPagamento }),
  });
  if (!resp || !resp.ok) {
    if (select) select.value = statusAnterior;
    let mensagem = "Não foi possível alterar o status.";
    if (resp) {
      try {
        const erro = await resp.json();
        mensagem = erro.erro || mensagem;
      } catch {
        mensagem = "Não foi possível alterar o status.";
      }
    }
    alert(mensagem);
    return;
  }
  await carregarAgendamentosDoMes();
  renderizarCalendario();
  atualizarPainelDoDia();
}

formConclusaoEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!alteracaoStatusPendente || !formConclusaoEl.reportValidity()) return;

  botaoConfirmarConclusaoEl.disabled = true;
  botaoConfirmarConclusaoEl.textContent = "Registrando...";
  try {
    const pendente = alteracaoStatusPendente;
    await alterarStatus(
      pendente.id,
      "CONCLUIDO",
      pendente.statusAnterior,
      pendente.select,
      conclusaoFormaPagamentoEl.value,
    );
    if (
      agendamentosDoMes.find(
        (item) =>
          String(item.id) === String(pendente.id) &&
          item.status === "CONCLUIDO",
      )
    ) {
      fecharModalConclusao(false);
    }
  } finally {
    botaoConfirmarConclusaoEl.disabled = false;
    botaoConfirmarConclusaoEl.textContent = "Concluir atendimento";
  }
});

document
  .getElementById("btn-cancelar-conclusao")
  .addEventListener("click", () => {
    fecharModalConclusao();
  });
modalConclusaoEl.addEventListener("click", (event) => {
  if (event.target === modalConclusaoEl) fecharModalConclusao();
});

async function excluirAgendamento(id) {
  if (!confirm("Deseja realmente excluir este agendamento?")) return;

  const resp = await apiFetch(`/api/agendamentos/${id}`, { method: "DELETE" });
  if (!resp || !resp.ok) {
    alert("Não foi possível excluir o agendamento.");
    return;
  }
  await carregarAgendamentosDoMes();
  renderizarCalendario();
  atualizarPainelDoDia();
}

formEdicaoEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!agendamentoEmEdicao) return;

  const dataEdicao = new Date(edicaoDataHoraEl.value);
  const servicoIds = servicosSelecionados(
    edicaoServicosOpcoesEl,
    "edicao-servico",
  );
  if (!servicoIds.length) {
    alert("Selecione ao menos um serviço.");
    return;
  }
  const duracaoEdicao = servicoIds.reduce((total, id) => {
    const servico = servicosDisponiveis.find((item) => Number(item.id) === id);
    return total + (Number(servico?.duracaoMinutos) || 0);
  }, 0);
  if (!horarioPermitido(
    edicaoDataHoraEl.value.slice(0, 10),
    edicaoDataHoraEl.value.slice(11, 16),
    duracaoEdicao,
  )) {
    alert("A data ou o horário está fora do funcionamento da barbearia.");
    return;
  }
  if (
    ehDiaAnterior(
      dataEdicao.getDate(),
      dataEdicao.getMonth(),
      dataEdicao.getFullYear(),
    )
  ) {
    alert("Não é possível agendar em um dia que já passou.");
    return;
  }

  const resp = await apiFetch(`/api/agendamentos/${agendamentoEmEdicao.id}`, {
    method: "PUT",
    body: JSON.stringify({
      servico: { id: servicoIds[0] },
      servicos: servicoIds.map((id) => ({ id })),
      clienteNome: edicaoClienteNomeEl.value.trim(),
      clienteTelefone: agendamentoEmEdicao.clienteTelefone,
      dataHora: edicaoDataHoraEl.value + ":00",
    }),
  });

  if (!resp || !resp.ok) {
    const erro = resp?.status === 409 ? await resp.json() : null;
    alert(erro?.erro || "Não foi possível atualizar o agendamento.");
    return;
  }

  fecharEdicao();
  await carregarAgendamentosDoMes();
  renderizarCalendario();
  atualizarPainelDoDia();
});

document
  .getElementById("btn-cancelar-edicao")
  .addEventListener("click", fecharEdicao);
modalEdicaoEl.addEventListener("click", (event) => {
  if (event.target === modalEdicaoEl) fecharEdicao();
});

formNovoAgendamento.addEventListener("submit", async (e) => {
  e.preventDefault();

  const clienteNome = document.getElementById("cliente-nome").value.trim();
  const servicoIds = servicosSelecionados(servicosOpcoesEl, "novo-servico");
  const horario = horarioSelect.value;
  const barbeiroId = barbeiroAgendaEl.value;
  if (!servicoIds.length) {
    alert("Selecione ao menos um serviço.");
    return;
  }
  if (!barbeiroId || barbeiroId === "todos") {
    alert("Selecione um barbeiro específico para criar um agendamento.");
    return;
  }

  if (ehDiaAnterior(diaSelecionado, mesAtual, anoAtual)) {
    alert("Não é possível agendar em um dia que já passou.");
    return;
  }
  const duracao = servicoIds.reduce((total, id) => {
    const servico = servicosDisponiveis.find((item) => Number(item.id) === id);
    return total + (Number(servico?.duracaoMinutos) || 0);
  }, 0);
  const data = `${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}-${String(diaSelecionado).padStart(2, "0")}`;
  if (!horarioPermitido(data, horario, duracao)) {
    alert("O horário selecionado está fora do funcionamento da barbearia.");
    return;
  }
  const dataHora = `${data}T${horario}:00`;

  const resp = await apiFetch("/api/agendamentos", {
    method: "POST",
    body: JSON.stringify({
      barbeiro: { id: Number(barbeiroId) },
      servico: { id: servicoIds[0] },
      servicos: servicoIds.map((id) => ({ id })),
      clienteNome,
      dataHora,
    }),
  });

  if (!resp) return;

  if (resp.status === 409 || resp.status === 400) {
    const erro = await resp.json();
    alert(erro.erro || "Não foi possível criar o agendamento.");
    return;
  }

  if (!resp.ok) {
    alert("Erro ao criar agendamento. Tente novamente.");
    return;
  }

  formNovoAgendamento.reset();
  await carregarAgendamentosDoMes();
  renderizarCalendario();
  atualizarPainelDoDia();
});

async function iniciar() {
  await carregarFuncionamento();
  popularHorariosBloqueio();
  await identificarUsuarioLogado();
  await carregarServicosEBarbeiros();
  await carregarAgendamentosDoMes();
  await carregarBloqueios();
  renderizarCalendario();
  atualizarPainelDoDia();
}

barbeiroAgendaEl.addEventListener("change", async () => {
  await carregarAgendamentosDoMes();
  await carregarBloqueios();
  renderizarCalendario();
  atualizarPainelDoDia();
});

iniciar();

servicosOpcoesEl.addEventListener("change", () => {
  gerarHorarios();
  atualizarDisponibilidadeDoFormulario();
});
