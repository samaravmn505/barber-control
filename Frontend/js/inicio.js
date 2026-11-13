let barbeiroAtual = null;
let barbeirosDisponiveis = [];
let servicosDisponiveis = [];
let todosAgendamentos = [];
let entradasDoMes = [];
let gastosDoMes = [];
let resumoFinanceiroMes = null;
let fluxoChart = null;
let servicosChart = null;
let funcionamento = {
  horarioAbertura: "08:00",
  horarioEncerramento: "20:00",
  diasFuncionamento: [1, 2, 3, 4, 5, 6, 7],
};

const modal = document.getElementById("add-modal");
const listaHojeEl = document.getElementById("appointments-list");
const totalAgendamentosEl = document.getElementById("total-agendamentos");
const saudacaoEl = document.getElementById("saudacao");
const profileNameEl = document.getElementById("profile-name");
const dashboardErroEl = document.getElementById("dashboard-erro");
const moedaBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// ===== Logout =====
document.getElementById("btn-logout").addEventListener("click", (e) => {
  e.preventDefault();
  localStorage.removeItem("token");
  window.location.href = "login.html";
});

// ===== Identificar quem está logado a partir do token =====
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

async function identificarBarbeiroLogado() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const payload = decodeJwtPayload(token);
  if (!payload || !payload.sub) return;

  const resp = await apiFetch("/api/usuarios");
  if (!resp) return;

  const usuarios = await resp.json();
  barbeiroAtual = usuarios.find((u) => u.email === payload.sub) || null;

  if (barbeiroAtual) {
    profileNameEl.textContent =
      barbeiroAtual.nomeBarbearia || barbeiroAtual.nome;
    saudacaoEl.textContent = `Olá, ${barbeiroAtual.nome}!`;
  }
}

// ===== Helpers de data =====
function ehHoje(dataHoraStr) {
  const data = new Date(dataHoraStr);
  const agora = new Date();
  return (
    data.getFullYear() === agora.getFullYear() &&
    data.getMonth() === agora.getMonth() &&
    data.getDate() === agora.getDate()
  );
}

// ===== Lista "Agendamentos de hoje" =====
function renderizarListaHoje() {
  const agendamentosDeHoje = todosAgendamentos
    .filter((a) => ehHoje(a.dataHora))
    .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));

  totalAgendamentosEl.textContent =
    agendamentosDeHoje.length.toLocaleString("pt-BR");
  if (agendamentosDeHoje.length === 0) {
    listaHojeEl.innerHTML = `<p style="text-align:center;color:#999;font-size:13.5px;">Nenhum agendamento para hoje.</p>`;
    return;
  }

  listaHojeEl.innerHTML = agendamentosDeHoje
    .map((a) => {
      const hora = new Date(a.dataHora).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `
      <div class="appointment-item">
        <span>${escaparHtml(a.clienteNome)}</span>
        <span class="appointment-time">${hora}h</span>
      </div>
    `;
    })
    .join("");
}

function dataLocal(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function obterPeriodoAtual() {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const dias = [];
  for (let dia = 1; dia <= hoje.getDate(); dia += 1) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
    dias.push({
      chave: dataLocal(data),
      rotulo: String(dia).padStart(2, "0"),
    });
  }
  return { inicio: dataLocal(inicio), fim: dataLocal(hoje), dias };
}

function atendimentosConcluidosDoMes() {
  const periodo = obterPeriodoAtual();
  return todosAgendamentos.filter((agendamento) => {
    const data = String(agendamento.dataHora || "").slice(0, 10);
    return (
      agendamento.status === "CONCLUIDO" &&
      data >= periodo.inicio &&
      data <= periodo.fim
    );
  });
}

function entradasManuaisDoMes() {
  return entradasDoMes.filter((entrada) => !entrada.agendamentoId);
}

function entradasDoPainel() {
  return [
    ...entradasManuaisDoMes(),
    ...atendimentosConcluidosDoMes().map((agendamento) => {
      const servicos = agendamento.servicos?.length
        ? agendamento.servicos
        : agendamento.servico
          ? [agendamento.servico]
          : [];
      return {
        data: String(agendamento.dataHora).slice(0, 10),
        valor: servicos.reduce(
          (total, servico) => total + Number(servico.valor || 0),
          0,
        ),
        servicos,
      };
    }),
  ];
}

function atualizarIndicadores() {
  if (!resumoFinanceiroMes) return;
  document.getElementById("faturamento-mes").textContent = moedaBRL.format(
    resumoFinanceiroMes.faturamento,
  );
  document.getElementById("gastos-mes").textContent = moedaBRL.format(
    resumoFinanceiroMes.gastos,
  );
  document.getElementById("lucro-mes").textContent = moedaBRL.format(
    resumoFinanceiroMes.lucro,
  );
  document.getElementById("atendimentos-mes").textContent = Number(
    resumoFinanceiroMes.atendimentos,
  ).toLocaleString("pt-BR");
}

function criarConjuntoDiario(movimentos, dias) {
  const valoresPorData = new Map(dias.map((dia) => [dia.chave, 0]));
  movimentos.forEach((movimento) => {
    const data = String(movimento.data).slice(0, 10);
    if (valoresPorData.has(data)) {
      valoresPorData.set(
        data,
        valoresPorData.get(data) + Number(movimento.valor || 0),
      );
    }
  });
  return dias.map((dia) => valoresPorData.get(dia.chave) || 0);
}

function renderizarGraficoFluxoFinanceiro() {
  const { dias } = obterPeriodoAtual();
  const entradas = entradasDoPainel();

  if (fluxoChart) fluxoChart.destroy();
  fluxoChart = new Chart(document.getElementById("fluxoFinanceiroChart"), {
    type: "line",
    data: {
      labels: dias.map((dia) => dia.rotulo),
      datasets: [
        {
          label: "Faturamento",
          data: criarConjuntoDiario(entradas, dias),
          borderColor: "#27864b",
          backgroundColor: "rgba(39, 134, 75, 0.12)",
          pointBackgroundColor: "#27864b",
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.3,
          fill: true,
        },
        {
          label: "Gastos",
          data: criarConjuntoDiario(gastosDoMes, dias),
          borderColor: "#d07b34",
          backgroundColor: "rgba(208, 123, 52, 0.08)",
          pointBackgroundColor: "#d07b34",
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.3,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, boxWidth: 8, padding: 16 },
        },
        tooltip: {
          callbacks: {
            label: (contexto) =>
              `${contexto.dataset.label}: ${moedaBRL.format(contexto.raw)}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: "#888", callback: (valor) => moedaBRL.format(valor) },
          grid: { color: "#f0f0f0" },
        },
        x: {
          ticks: { color: "#666", maxTicksLimit: 12 },
          grid: { display: false },
        },
      },
    },
  });
}

function renderizarGraficoServicos() {
  const contagem = new Map();
  const servicosRealizados = entradasDoPainel().flatMap(
    (entrada) => entrada.servicos || [],
  );
  servicosRealizados.forEach((servico) => {
    const nomeServico = servico.nome || "Serviço não informado";
    contagem.set(nomeServico, (contagem.get(nomeServico) || 0) + 1);
  });

  const servicos = Array.from(contagem.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  if (servicosChart) servicosChart.destroy();
  servicosChart = new Chart(
    document.getElementById("servicosRealizadosChart"),
    {
      type: "bar",
      data: {
        labels: servicos.length
          ? servicos.map(([nome]) => nome)
          : ["Sem atendimentos"],
        datasets: [
          {
            label: "Atendimentos",
            data: servicos.length
              ? servicos.map(([, quantidade]) => quantidade)
              : [0],
            backgroundColor: "#ffc107",
            borderRadius: 6,
            maxBarThickness: 28,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (contexto) =>
                `${contexto.raw} atendimento${contexto.raw === 1 ? "" : "s"}`,
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { stepSize: 1, color: "#888" },
            grid: { color: "#f0f0f0" },
          },
          y: { ticks: { color: "#666" }, grid: { display: false } },
        },
      },
    },
  );
}

async function carregarFinanceiroDoMes() {
  const periodo = obterPeriodoAtual();
  const consulta = (tipo) => {
    const parametros = new URLSearchParams({
      tipo,
      inicio: periodo.inicio,
      fim: periodo.fim,
    });
    return apiFetch(`/api/financeiro?${parametros}`);
  };
  const [respEntradas, respGastos, respResumo] = await Promise.all([
    consulta("ENTRADA"),
    consulta("SAIDA"),
    apiFetch(
      `/api/financeiro/resumo?inicio=${periodo.inicio}&fim=${periodo.fim}`,
    ),
  ]);
  if (!respEntradas || !respGastos || !respResumo) return;
  if (!respEntradas.ok || !respGastos.ok || !respResumo.ok) {
    throw new Error(
      "Não foi possível carregar os dados financeiros deste mês.",
    );
  }
  [entradasDoMes, gastosDoMes, resumoFinanceiroMes] = await Promise.all([
    respEntradas.json(),
    respGastos.json(),
    respResumo.json(),
  ]);
}

// ===== Modal: novo agendamento rápido =====
function popularSelectServicos() {
  const container = document.getElementById("client-services");
  container.innerHTML = servicosDisponiveis
    .map(
      (servico) => `
    <label class="servico-opcao">
      <input type="checkbox" name="client-service" value="${servico.id}" />
      <span>${escaparHtml(servico.nome)}</span>
    </label>
  `,
    )
    .join("");
}

function popularSelectBarbeiros() {
  const select = document.getElementById("client-barber");
  select.innerHTML = [
    '<option value="" disabled selected>Selecione o barbeiro</option>',
    ...barbeirosDisponiveis.map(
      (barbeiro) =>
        `<option value="${barbeiro.id}">${escaparHtml(barbeiro.nome)}</option>`,
    ),
  ].join("");
}

document.getElementById("open-modal-btn").addEventListener("click", () => {
  modal.style.display = "flex";
});

document.getElementById("close-modal-btn").addEventListener("click", () => {
  modal.style.display = "none";
});

document
  .getElementById("save-appointment-btn")
  .addEventListener("click", async () => {
    const nomeInput = document.getElementById("client-name");
    const horaInput = document.getElementById("client-time");
    const barbeiroSelect = document.getElementById("client-barber");
    const servicoIds = Array.from(
      document.querySelectorAll(
        '#client-services input[name="client-service"]:checked',
      ),
    ).map((checkbox) => Number(checkbox.value));

    if (
      !nomeInput.value.trim() ||
      !horaInput.value ||
      !barbeiroSelect.value ||
      !servicoIds.length
    ) {
      alert("Por favor, preencha nome, barbeiro, horário e serviço.");
      return;
    }

    if (!barbeiroAtual) {
      alert(
        "Não foi possível identificar o barbeiro logado. Faça login novamente.",
      );
      return;
    }

    const hoje = new Date();
    const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    const diaDaSemana = hoje.getDay() || 7;
    const [aberturaHora, aberturaMinuto] = funcionamento.horarioAbertura.split(":").map(Number);
    const [encerramentoHora, encerramentoMinuto] = funcionamento.horarioEncerramento.split(":").map(Number);
    const [horaSelecionada, minutoSelecionado] = horaInput.value.split(":").map(Number);
    const inicioMinutos = horaSelecionada * 60 + minutoSelecionado;
    const aberturaMinutos = aberturaHora * 60 + aberturaMinuto;
    const encerramentoMinutos = encerramentoHora * 60 + encerramentoMinuto;
    const duracao = servicoIds.reduce((total, id) => {
      const servico = servicosDisponiveis.find((item) => Number(item.id) === id);
      return total + (Number(servico?.duracaoMinutos) || 0);
    }, 0);
    if (!funcionamento.diasFuncionamento.includes(diaDaSemana)) {
      alert("A barbearia não atende hoje.");
      return;
    }
    if (inicioMinutos < aberturaMinutos || inicioMinutos + duracao > encerramentoMinutos) {
      alert("O horário selecionado está fora do funcionamento da barbearia.");
      return;
    }
    const dataHora = `${dataHoje}T${horaInput.value}:00`;

    if (
      new Date(dataHora) <
      new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
    ) {
      alert("Não é possível agendar em um dia que já passou.");
      return;
    }

    const resp = await apiFetch("/api/agendamentos", {
      method: "POST",
      body: JSON.stringify({
        barbeiro: { id: Number(barbeiroSelect.value) },
        servico: { id: servicoIds[0] },
        servicos: servicoIds.map((id) => ({ id })),
        clienteNome: nomeInput.value.trim(),
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

    nomeInput.value = "";
    horaInput.value = "";
    document
      .querySelectorAll('#client-services input[name="client-service"]')
      .forEach((checkbox) => {
        checkbox.checked = false;
      });
    modal.style.display = "none";

    const respAgendamentos = await apiFetch("/api/agendamentos");
    if (respAgendamentos) {
      todosAgendamentos = await respAgendamentos.json();
      renderizarListaHoje();
      try {
        await carregarFinanceiroDoMes();
        atualizarIndicadores();
        renderizarGraficoFluxoFinanceiro();
        renderizarGraficoServicos();
      } catch (error) {
        dashboardErroEl.hidden = false;
        dashboardErroEl.textContent = error.message;
      }
    }
  });

// ===== Inicialização =====
async function carregarDados() {
  await identificarBarbeiroLogado();

  const [respServicos, respAgendamentos, respBarbeiros, respBarbearia] = await Promise.all([
    apiFetch("/api/servicos"),
    apiFetch("/api/agendamentos"),
    apiFetch("/api/barbeiros"),
    apiFetch("/api/barbearia"),
  ]);

  if (!respServicos || !respAgendamentos || !respBarbeiros || !respBarbearia) return;
  if (!respServicos.ok || !respAgendamentos.ok || !respBarbeiros.ok || !respBarbearia.ok) {
    throw new Error("Não foi possível carregar os dados do painel.");
  }

  [servicosDisponiveis, todosAgendamentos, barbeirosDisponiveis] = await Promise.all([
    respServicos.json(),
    respAgendamentos.json(),
    respBarbeiros.json(),
  ]);
  const dadosBarbearia = await respBarbearia.json();
  funcionamento = {
    horarioAbertura: dadosBarbearia.horarioAbertura.slice(0, 5),
    horarioEncerramento: dadosBarbearia.horarioEncerramento.slice(0, 5),
    diasFuncionamento: dadosBarbearia.diasFuncionamento,
  };
  const horarioInput = document.getElementById("client-time");
  const horarioAjuda = document.getElementById("client-time-help");
  horarioInput.min = funcionamento.horarioAbertura;
  horarioInput.max = funcionamento.horarioEncerramento;
  horarioInput.step = 1800;
  const diaAtual = new Date().getDay() || 7;
  horarioInput.disabled = !funcionamento.diasFuncionamento.includes(diaAtual);
  horarioAjuda.textContent = horarioInput.disabled
    ? "A barbearia não atende hoje."
    : `Atendimento das ${funcionamento.horarioAbertura} às ${funcionamento.horarioEncerramento}.`;

  popularSelectServicos();
  popularSelectBarbeiros();
  renderizarListaHoje();
  await carregarFinanceiroDoMes();
  atualizarIndicadores();
  renderizarGraficoFluxoFinanceiro();
  renderizarGraficoServicos();
}

carregarDados().catch((error) => {
  dashboardErroEl.hidden = false;
  dashboardErroEl.textContent =
    error.message || "Não foi possível carregar os dados do painel.";
});
