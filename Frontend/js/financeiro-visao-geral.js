const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const nomesDias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const cores = ["#27ae60", "#ffc107", "#4f7cac", "#e07a5f", "#8e6cbb", "#5a9b8a", "#d56b9a"];
const graficos = {};
const hoje = new Date();
const dataHoje = (data) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
const parseDia = (valor) => new Date(`${valor}T12:00:00`);
const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
const inicioEl = document.getElementById("filtro-inicio");
const fimEl = document.getElementById("filtro-fim");
const profissionalEl = document.getElementById("filtro-profissional");
const pagamentoEl = document.getElementById("filtro-pagamento");
const statusEl = document.getElementById("visao-status");

inicioEl.value = dataHoje(inicioMes);
fimEl.value = dataHoje(hoje);

let perfil = {};
let barbeiros = [];
let servicos = [];
let agendamentos = [];
let metaMensal = 10000;
let administrador = false;
let funcionamento = {
  horarioAbertura: "08:00",
  horarioEncerramento: "20:00",
  diasFuncionamento: [1, 2, 3, 4, 5, 6, 7],
};

function dinheiro(valor) {
  return moeda.format(Number(valor) || 0);
}

function textoSeguro(valor) {
  return escaparHtml(valor ?? "");
}

function mostrarStatus(mensagem, erro = false) {
  statusEl.textContent = mensagem;
  statusEl.classList.toggle("is-error", erro);
  statusEl.classList.toggle("is-visible", Boolean(mensagem));
}

async function erroResposta(resposta, mensagemPadrao) {
  try {
    const corpo = await resposta.json();
    return corpo.erro || corpo.message || mensagemPadrao;
  } catch {
    return mensagemPadrao;
  }
}

async function buscarJson(caminho, mensagemErro) {
  const resposta = await apiFetch(caminho);
  if (!resposta) throw new Error("Sua sessão expirou. Entre novamente.");
  if (!resposta.ok) throw new Error(await erroResposta(resposta, mensagemErro));
  return resposta.json();
}

function dataDoAgendamento(agendamento) {
  return String(agendamento.dataHora || "").slice(0, 10);
}

function agendamentoPorId(id) {
  return agendamentos.find((item) => String(item.id) === String(id));
}

function servicosDoAgendamento(agendamento) {
  const lista = Array.isArray(agendamento.servicos) && agendamento.servicos.length
    ? agendamento.servicos
    : agendamento.servico
      ? [agendamento.servico]
      : [];
  return lista.map((servico) => ({
    id: servico.id,
    nome: servico.nome || "Serviço",
    valor: Number(servico.valor) || 0,
  }));
}

function entradasComPendentes(entradas) {
  const agendamentosComEntrada = new Set(
    entradas.map((entrada) => String(entrada.agendamentoId)).filter((id) => id !== "null"),
  );
  const pendentes = agendamentos
    .filter((item) => item.status === "CONCLUIDO" && !agendamentosComEntrada.has(String(item.id)))
    .map((item) => {
      const listaServicos = servicosDoAgendamento(item);
      return {
        id: `pendente-${item.id}`,
        agendamentoId: item.id,
        data: dataDoAgendamento(item),
        valor: listaServicos.reduce((total, servico) => total + servico.valor, 0),
        formaPagamento: "PENDENTE",
        usuarioNome: item.barbeiro?.nome || "Profissional",
        nomeCliente: item.clienteNome,
        servicos: listaServicos,
      };
    });
  return [...entradas, ...pendentes];
}

function dentroDoPeriodo(data, inicio, fim) {
  return data >= inicio && data <= fim;
}

function filtrarEntradas(entradas, inicio, fim, incluirPendentes = true) {
  const profissional = profissionalEl.value;
  const formaPagamento = pagamentoEl.value;
  return entradas.filter((entrada) => {
    if (!dentroDoPeriodo(entrada.data, inicio, fim)) return false;
    if (!incluirPendentes && entrada.formaPagamento === "PENDENTE") return false;
    if (formaPagamento && entrada.formaPagamento !== formaPagamento) return false;
    if (profissional) {
      const agendamento = agendamentoPorId(entrada.agendamentoId);
      if (!agendamento || String(agendamento.barbeiro?.id) !== profissional) return false;
    }
    return true;
  });
}

function filtrarSaidas(saidas, inicio, fim) {
  return saidas.filter((saida) =>
    dentroDoPeriodo(saida.data, inicio, fim)
    && (!pagamentoEl.value || saida.formaPagamento === pagamentoEl.value));
}

function diferencaDias(inicio, fim) {
  return Math.floor((Date.UTC(fim.getFullYear(), fim.getMonth(), fim.getDate())
    - Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())) / 86400000) + 1;
}

function somar(lista) {
  return lista.reduce((total, item) => total + (Number(item.valor) || 0), 0);
}

function dadosPorPeriodo(inicio, fim, entradas, saidas) {
  const receitas = filtrarEntradas(entradas, inicio, fim);
  const despesas = filtrarSaidas(saidas, inicio, fim);
  const faturamento = somar(receitas);
  const gastos = somar(despesas);
  const atendimentos = receitas.length;
  return {
    receitas,
    despesas,
    faturamento,
    gastos,
    lucro: faturamento - gastos,
    ticket: atendimentos ? faturamento / atendimentos : 0,
    atendimentos,
  };
}

function comparar(valor, anterior, melhorQuandoSobe = true) {
  if (!anterior && !valor) return { texto: "Sem movimentação no período anterior", classe: "" };
  if (!anterior) return { texto: `▲ Novo · ${dinheiro(valor)}`, classe: melhorQuandoSobe ? "is-up" : "is-down" };
  const variacao = ((valor - anterior) / Math.abs(anterior)) * 100;
  if (Math.abs(variacao) < 0.05) return { texto: "→ Sem variação", classe: "" };
  const subiu = variacao > 0;
  const favoravel = subiu === melhorQuandoSobe;
  return {
    texto: `${subiu ? "▲" : "▼"} ${Math.abs(variacao).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs. período anterior`,
    classe: favoravel ? "is-up" : "is-down",
  };
}

function definirComparativo(id, atual, anterior, melhorQuandoSobe) {
  const elemento = document.getElementById(id);
  const resultado = comparar(atual, anterior, melhorQuandoSobe);
  elemento.textContent = resultado.texto;
  elemento.classList.toggle("is-up", resultado.classe === "is-up");
  elemento.classList.toggle("is-down", resultado.classe === "is-down");
}

function chavesData(inicioValor, fimValor) {
  const inicio = parseDia(inicioValor);
  const fim = parseDia(fimValor);
  const totalDias = diferencaDias(inicio, fim);
  const diario = totalDias <= 31;
  const chaves = [];
  if (diario) {
    for (let indice = 0; indice < totalDias; indice += 1) {
      const data = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + indice);
      const id = dataHoje(data);
      chaves.push({ id, label: data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) });
    }
  } else {
    const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1, 12);
    const ultimoMes = new Date(fim.getFullYear(), fim.getMonth(), 1, 12);
    while (cursor <= ultimoMes) {
      chaves.push({
        id: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
        label: cursor.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  return { chaves, diario };
}

function chaveData(valor, diario) {
  return diario ? valor : valor.slice(0, 7);
}

function destruirGrafico(id) {
  if (graficos[id]) graficos[id].destroy();
}

function opcoesGrafico(moedaTooltip = false, horizontal = false, unidade = "serviço(s)", rotulosCategoria = []) {
  return {
    indexAxis: horizontal ? "y" : "x",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (contexto) => moedaTooltip
            ? dinheiro(contexto.raw)
            : `${contexto.raw} ${unidade}`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: horizontal,
        ticks: {
          color: "#777",
          autoSkip: true,
          callback: horizontal && moedaTooltip ? (valor) => dinheiro(valor) : undefined,
        },
        grid: { display: !horizontal, color: "#f0f0f0" },
      },
      y: {
        type: horizontal ? "category" : undefined,
        display: true,
        beginAtZero: !horizontal,
        ticks: {
          color: "#777",
          autoSkip: !horizontal,
          callback: horizontal
            ? (_valor, indice) => rotulosCategoria[indice] ?? ""
            : moedaTooltip ? (valor) => dinheiro(valor) : undefined,
        },
        grid: { display: !horizontal, color: "#f0f0f0" },
      },
    },
  };
}

function renderizarGraficoFinanceiro(periodo, inicio, fim) {
  const { chaves, diario } = chavesData(inicio, fim);
  const receitasPorData = new Map(chaves.map(({ id }) => [id, 0]));
  const despesasPorData = new Map(chaves.map(({ id }) => [id, 0]));
  periodo.receitas.forEach((item) => {
    const chave = chaveData(item.data, diario);
    if (receitasPorData.has(chave)) receitasPorData.set(chave, receitasPorData.get(chave) + Number(item.valor || 0));
  });
  periodo.despesas.forEach((item) => {
    const chave = chaveData(item.data, diario);
    if (despesasPorData.has(chave)) despesasPorData.set(chave, despesasPorData.get(chave) + Number(item.valor || 0));
  });
  destruirGrafico("financeiro");
  graficos.financeiro = new Chart(document.getElementById("grafico-financeiro"), {
    type: "line",
    data: {
      labels: chaves.map(({ label }) => label),
      datasets: [
        { label: "Faturamento", data: chaves.map(({ id }) => receitasPorData.get(id)), borderColor: "#27ae60", backgroundColor: "rgba(39,174,96,.12)", fill: true, tension: 0.3 },
        { label: "Gastos", data: chaves.map(({ id }) => despesasPorData.get(id)), borderColor: "#e07a5f", backgroundColor: "rgba(224,122,95,.08)", fill: true, tension: 0.3 },
        { label: "Lucro", data: chaves.map(({ id }) => receitasPorData.get(id) - despesasPorData.get(id)), borderColor: "#4f7cac", tension: 0.3 },
      ],
    },
    options: {
      ...opcoesGrafico(true),
      plugins: {
        legend: { display: true, position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: { callbacks: { label: (contexto) => `${contexto.dataset.label}: ${dinheiro(contexto.raw)}` } },
      },
    },
  });
}

function renderizarBarras(id, labels, valores, valorEmMoeda = false, unidade = "serviço(s)") {
  destruirGrafico(id);
  const canvas = document.getElementById(id === "dias" ? "grafico-dias"
    : id === "profissionais" ? "grafico-profissionais"
      : id === "por-minuto" ? "grafico-por-minuto" : "grafico-servicos");
  graficos[id] = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: valores,
        backgroundColor: labels.map((_, indice) => cores[indice % cores.length]),
        borderRadius: 5,
        maxBarThickness: 30,
      }],
    },
    options: opcoesGrafico(valorEmMoeda, true, unidade, labels),
  });
}

function renderizarRosca(id, labels, valores, moedaTooltip = true) {
  destruirGrafico(id);
  graficos[id] = new Chart(document.getElementById(id === "despesas"
    ? "grafico-despesas" : id === "pagamentos" ? "grafico-pagamentos" : "grafico-presenca"), {
    type: "doughnut",
    data: {
      labels: labels.length ? labels : ["Sem movimentação"],
      datasets: [{
        data: labels.length ? valores : [1],
        backgroundColor: labels.length ? cores : ["#e5e5e5"],
        borderColor: "#fff",
        borderWidth: labels.length ? 3 : 0,
        hoverOffset: 5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "64%",
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, padding: 14 } },
        tooltip: {
          filter: () => labels.length > 0,
          callbacks: {
            label: (contexto) => {
              const percentual = valores.reduce((total, valor) => total + valor, 0)
                ? (Number(contexto.raw) / valores.reduce((total, valor) => total + valor, 0)) * 100
                : 0;
              return `${contexto.label}: ${moedaTooltip ? dinheiro(contexto.raw) : `${contexto.raw}%`} (${percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)`;
            },
          },
        },
      },
    },
  });
}

function agregarServicos(receitas) {
  const porServico = new Map();
  receitas.forEach((entrada) => (entrada.servicos || []).forEach((servico) => {
    const chave = String(servico.id ?? servico.nome);
    const item = porServico.get(chave) || { id: servico.id, nome: servico.nome || "Serviço", quantidade: 0, receita: 0 };
    item.quantidade += 1;
    item.receita += Number(servico.valor) || 0;
    porServico.set(chave, item);
  }));
  return Array.from(porServico.values());
}

function renderizarServicos(receitas) {
  const agregados = agregarServicos(receitas);
  const maisVendidos = agregados.slice().sort((a, b) => b.quantidade - a.quantidade).slice(0, 7);
  renderizarBarras("servicos", maisVendidos.map((item) => item.nome), maisVendidos.map((item) => item.quantidade));

  const precosPorMinuto = agregados.map((item) => {
    const servico = servicos.find((atual) => String(atual.id) === String(item.id));
    const minutos = Number(servico?.duracaoMinutos);
    return { nome: item.nome, valor: minutos > 0 ? item.receita / (minutos * item.quantidade) : null };
  }).filter((item) => item.valor !== null).sort((a, b) => b.valor - a.valor).slice(0, 7);
  renderizarBarras("por-minuto", precosPorMinuto.map((item) => item.nome),
    precosPorMinuto.map((item) => Number(item.valor.toFixed(2))), true);
}

function renderizarProfissionais(receitas) {
  const valores = new Map();
  receitas.forEach((entrada) => {
    const agendamento = agendamentoPorId(entrada.agendamentoId);
    const nome = agendamento?.barbeiro?.nome || "Lançamento manual";
    valores.set(nome, (valores.get(nome) || 0) + Number(entrada.valor || 0));
  });
  const ordenados = Array.from(valores.entries()).sort((a, b) => b[1] - a[1]);
  renderizarBarras("profissionais", ordenados.map(([nome]) => nome), ordenados.map(([, valor]) => valor), true);
}

function renderizarDias(inicio, fim) {
  const contagens = Array(7).fill(0);
  const profissional = profissionalEl.value;
  const finalizados = agendamentos.filter((agendamento) => {
    const dia = dataDoAgendamento(agendamento);
    if (agendamento.status !== "CONCLUIDO" || !dentroDoPeriodo(dia, inicio, fim)) return false;
    return !profissional || String(agendamento.barbeiro?.id) === profissional;
  });
  finalizados.forEach((agendamento) => {
    contagens[parseDia(dataDoAgendamento(agendamento)).getDay()] += 1;
  });
  const diasAbertos = contagens.map((quantidade, indice) => ({ quantidade, indice }))
    .filter((item) => funcionamento.diasFuncionamento.includes(item.indice === 0 ? 7 : item.indice));
  const diasAtivos = diasAbertos.filter((item) => item.quantidade > 0);
  const maisMovimentado = diasAtivos.slice().sort((a, b) => b.quantidade - a.quantidade)[0];
  const menosMovimentado = diasAbertos.slice()
    .sort((a, b) => a.quantidade - b.quantidade);
  document.getElementById("dias-insight").textContent = maisMovimentado
    ? `Mais movimentado: ${nomesDias[maisMovimentado.indice]} (${maisMovimentado.quantidade} atendimentos).`
    : "Nenhum atendimento concluído no período.";
  document.getElementById("dias-menos-movimentados").innerHTML = menosMovimentado.length
    ? menosMovimentado.slice(0, 3).map((dia) => `
        <div class="operacao-item"><strong>${nomesDias[dia.indice]}</strong><span>${dia.quantidade} atendimento(s)</span></div>
      `).join("")
    : '<p class="financeiro-vazio">Sem atendimentos concluídos neste período.</p>';
  renderizarBarras(
    "dias",
    diasAbertos.map((item) => diasSemana[item.indice]),
    diasAbertos.map((item) => item.quantidade),
    false,
    "atendimento(s)",
  );
}

function renderizarMapaCalor(inicio, fim) {
  const dias = [1, 2, 3, 4, 5, 6, 7]
    .filter((dia) => funcionamento.diasFuncionamento.includes(dia));
  const abertura = funcionamento.horarioAbertura.split(":").map(Number);
  const encerramento = funcionamento.horarioEncerramento.split(":").map(Number);
  const minutosAbertura = abertura[0] * 60 + abertura[1];
  const minutosEncerramento = encerramento[0] * 60 + encerramento[1];
  const horas = [];
  for (let minuto = minutosAbertura; minuto < minutosEncerramento; minuto += 60) {
    horas.push(minuto);
  }
  const contagens = new Map();
  agendamentos.forEach((agendamento) => {
    const dia = dataDoAgendamento(agendamento);
    if (!dentroDoPeriodo(dia, inicio, fim) || agendamento.status === "CANCELADO") return;
    if (profissionalEl.value && String(agendamento.barbeiro?.id) !== profissionalEl.value) return;
    const horario = new Date(agendamento.dataHora);
    const diaISO = horario.getDay() || 7;
    const minutos = horario.getHours() * 60 + horario.getMinutes();
    if (!dias.includes(diaISO) || minutos < minutosAbertura || minutos >= minutosEncerramento) return;
    const faixaHora = Math.floor((minutos - minutosAbertura) / 60);
    const chave = `${diaISO}-${faixaHora}`;
    contagens.set(chave, (contagens.get(chave) || 0) + 1);
  });
  const maior = Math.max(0, ...contagens.values());
  const celulas = [
    '<span class="heatmap-label"></span>',
    ...dias.map((dia) => `<span class="heatmap-label">${diasSemana[dia % 7]}</span>`),
  ];
  horas.forEach((minutoInicio, indiceHora) => {
    const horaRotulo = `${String(Math.floor(minutoInicio / 60)).padStart(2, "0")}:${String(minutoInicio % 60).padStart(2, "0")}`;
    celulas.push(`<span class="heatmap-label hora">${horaRotulo}</span>`);
    dias.forEach((diaISO) => {
      const quantidade = contagens.get(`${diaISO}-${indiceHora}`) || 0;
      const intensidade = quantidade ? Math.max(1, Math.ceil((quantidade / maior) * 4)) : 0;
      const coresFundo = ["#f3f3f3", "#d7f0df", "#a9dfb9", "#6fc687", "#27ae60"];
      celulas.push(`<span class="heatmap-cell" title="${diasSemana[diaISO % 7]} às ${horaRotulo} · ${quantidade} agendamento(s)" style="background:${coresFundo[intensidade]}"></span>`);
    });
  });
  document.getElementById("mapa-calor").innerHTML =
    `<div class="heatmap-grid" style="grid-template-columns:60px repeat(${dias.length}, minmax(44px, 1fr))">${celulas.join("")}</div>`;
}

function renderizarLista(id, lista, limite, entrada) {
  const elemento = document.getElementById(id);
  const recentes = lista.slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, limite);
  elemento.innerHTML = recentes.length ? recentes.map((item) => {
    const titulo = entrada ? item.nomeCliente || item.usuarioNome || "Entrada" : item.descricao || "Despesa";
    const detalhe = entrada
      ? (item.servicos || []).map((servico) => servico.nome).join(", ") || "Lançamento manual"
      : [item.categoria, item.tipoDespesa === "FIXA" ? "Fixa" : item.tipoDespesa === "VARIAVEL" ? "Variável" : "Não classificada"]
        .filter(Boolean).join(" · ");
    const dataFormatada = parseDia(item.data).toLocaleDateString("pt-BR");
    return `
      <article class="operacao-item">
        <div class="operacao-detalhes">
          <strong>${textoSeguro(titulo)}</strong>
          <span>${textoSeguro(detalhe)}</span>
          <small>${dataFormatada}</small>
        </div>
        <strong class="operacao-valor">${dinheiro(item.valor)}</strong>
      </article>
    `;
  }).join("") : '<p class="financeiro-vazio">Nenhuma movimentação no período selecionado.</p>';
}

function renderizarMeta(receitas, inicioMesAtual) {
  const inicio = dataHoje(inicioMesAtual);
  const fim = dataHoje(hoje);
  const atual = somar(filtrarEntradas(receitas, inicio, fim));
  const atingido = metaMensal > 0 ? Math.min(atual / metaMensal, 1) * 100 : 0;
  const restante = Math.max(metaMensal - atual, 0);
  document.getElementById("meta-progresso-texto").textContent =
    `${dinheiro(atual)} de ${dinheiro(metaMensal)}`;
  document.getElementById("meta-progresso-barra").style.width = `${atingido}%`;
  document.getElementById("meta-restante").textContent = restante
    ? `Faltam ${dinheiro(restante)} para alcançar a meta.`
    : "Meta mensal atingida. Parabéns!";
  document.getElementById("meta-mensal-input").value = metaMensal.toFixed(2);
}

function renderizarPontoEquilibrio(periodo) {
  const fixas = somar(periodo.despesas.filter((item) => item.tipoDespesa === "FIXA"));
  const variaveis = somar(periodo.despesas.filter((item) => item.tipoDespesa === "VARIAVEL"));
  const proporcaoVariavel = periodo.faturamento > 0 ? variaveis / periodo.faturamento : 0;
  const atingivel = proporcaoVariavel < 1;
  const ponto = fixas === 0 ? 0 : atingivel ? fixas / (1 - proporcaoVariavel) : null;
  document.getElementById("kpi-equilibrio").textContent = ponto === null ? "Não atingido" : dinheiro(ponto);
  document.getElementById("legenda-equilibrio").textContent = periodo.despesas.some((item) => !item.tipoDespesa)
    ? "Estimativa; despesas antigas sem classificação são omitidas"
    : "Estimativa no período · custos fixos ÷ margem de contribuição";
}

function renderizarDistribuicoes(periodo, inicio, fim) {
  const totaisDespesa = new Map([["Fixa", 0], ["Variável", 0], ["Não classificada", 0]]);
  periodo.despesas.forEach((item) => {
    const categoria = item.tipoDespesa === "FIXA" ? "Fixa"
      : item.tipoDespesa === "VARIAVEL" ? "Variável" : "Não classificada";
    totaisDespesa.set(categoria, totaisDespesa.get(categoria) + Number(item.valor || 0));
  });
  const despesas = Array.from(totaisDespesa.entries()).filter(([, valor]) => valor > 0);
  renderizarRosca("despesas", despesas.map(([nome]) => nome), despesas.map(([, valor]) => valor));

  const pagamentos = new Map();
  periodo.receitas.forEach((entrada) => {
    const forma = entrada.formaPagamento === "PENDENTE" ? "Pendente"
      : ({ DINHEIRO: "Dinheiro", PIX: "Pix", DEBITO: "Débito", CREDITO: "Crédito" }[entrada.formaPagamento] || "Não informado");
    pagamentos.set(forma, (pagamentos.get(forma) || 0) + Number(entrada.valor || 0));
  });
  const formas = Array.from(pagamentos.entries()).filter(([, valor]) => valor > 0);
  renderizarRosca("pagamentos", formas.map(([nome]) => nome), formas.map(([, valor]) => valor));

  const profissional = profissionalEl.value;
  const finalizados = agendamentos.filter((item) => {
    const dia = dataDoAgendamento(item);
    return (item.status === "CONCLUIDO" || item.status === "CANCELADO")
      && dentroDoPeriodo(dia, inicio, fim)
      && (!profissional || String(item.barbeiro?.id) === profissional);
  });
  const compareceram = finalizados.filter((item) => item.status === "CONCLUIDO").length;
  const cancelados = finalizados.filter((item) => item.status === "CANCELADO").length;
  const total = compareceram + cancelados;
  const taxaPresenca = total ? (compareceram / total) * 100 : 0;
  const taxaCancelamento = total ? (cancelados / total) * 100 : 0;
  renderizarRosca("presenca", ["Comparecimento", "Cancelamento"], [taxaPresenca, taxaCancelamento], false);
  document.getElementById("presenca-insight").textContent = total
    ? `${taxaPresenca.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de comparecimento · ${taxaCancelamento.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de cancelamento (${total} agendamentos finalizados).`
    : "Sem agendamentos finalizados no período.";
}

function atualizarIndicadores(periodo, anterior) {
  document.getElementById("kpi-faturamento").textContent = dinheiro(periodo.faturamento);
  document.getElementById("kpi-gastos").textContent = dinheiro(periodo.gastos);
  document.getElementById("kpi-lucro").textContent = dinheiro(periodo.lucro);
  document.getElementById("kpi-ticket").textContent = dinheiro(periodo.ticket);
  definirComparativo("comparativo-faturamento", periodo.faturamento, anterior.faturamento, true);
  definirComparativo("comparativo-gastos", periodo.gastos, anterior.gastos, false);
  definirComparativo("comparativo-lucro", periodo.lucro, anterior.lucro, true);
  definirComparativo("comparativo-ticket", periodo.ticket, anterior.ticket, true);
  renderizarPontoEquilibrio(periodo);
}

async function carregarVisao() {
  mostrarStatus("");
  try {
    const inicio = inicioEl.value;
    const fim = fimEl.value;
    if (!inicio || !fim || inicio > fim) throw new Error("Selecione um período válido.");

    const inicioData = parseDia(inicio);
    const fimData = parseDia(fim);
    const duracao = diferencaDias(inicioData, fimData);
    const anteriorInicio = dataHoje(new Date(inicioData.getFullYear(), inicioData.getMonth(), inicioData.getDate() - duracao));
    const anteriorFim = dataHoje(new Date(inicioData.getFullYear(), inicioData.getMonth(), inicioData.getDate() - 1));
    const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const dataInicioBusca = [inicio, anteriorInicio, dataHoje(inicioMesAtual)].sort()[0];
    const dataFimBusca = [fim, dataHoje(hoje)].sort().slice(-1)[0];
    const inicioQuery = encodeURIComponent(dataInicioBusca);
    const fimQuery = encodeURIComponent(dataFimBusca);
    const [entradas, saidas] = await Promise.all([
      buscarJson(`/api/financeiro?tipo=ENTRADA&inicio=${inicioQuery}&fim=${fimQuery}`, "Não foi possível carregar as entradas."),
      buscarJson(`/api/financeiro?tipo=SAIDA&inicio=${inicioQuery}&fim=${fimQuery}`, "Não foi possível carregar as saídas."),
    ]);

    const todasEntradas = entradasComPendentes(entradas);
    const periodo = dadosPorPeriodo(inicio, fim, todasEntradas, saidas);
    const anterior = dadosPorPeriodo(anteriorInicio, anteriorFim, todasEntradas, saidas);
    atualizarIndicadores(periodo, anterior);
    renderizarGraficoFinanceiro(periodo, inicio, fim);
    renderizarServicos(periodo.receitas);
    renderizarDias(inicio, fim);
    renderizarProfissionais(periodo.receitas);
    renderizarDistribuicoes(periodo, inicio, fim);
    renderizarMapaCalor(inicio, fim);
    renderizarLista("ultimas-entradas", periodo.receitas, 5, true);
    renderizarLista("ultimas-saidas", periodo.despesas, 4, false);
    const receitasMes = filtrarEntradas(todasEntradas, dataHoje(inicioMesAtual), dataHoje(hoje));
    renderizarMeta(receitasMes, inicioMesAtual);
  } catch (erro) {
    mostrarStatus(erro.message || "Não foi possível carregar a visão financeira.", true);
  }
}

function popularFiltros() {
  const todas = barbeiros.map((barbeiro) =>
    `<option value="${barbeiro.id}">${textoSeguro(barbeiro.nome)}</option>`).join("");
  profissionalEl.insertAdjacentHTML("beforeend", todas);
  const nomeUnidade = perfil.nomeBarbearia || "Unidade atual";
  document.getElementById("filtro-unidade").innerHTML =
    `<option value="unica">${textoSeguro(nomeUnidade)} · unidade única</option>`;
}

async function salvarMeta(evento) {
  evento.preventDefault();
  const valor = Number(document.getElementById("meta-mensal-input").value);
  if (!Number.isFinite(valor) || valor <= 0) {
    mostrarStatus("Informe uma meta mensal maior que zero.", true);
    return;
  }
  try {
    const resposta = await apiFetch("/api/financeiro/meta-mensal", {
      method: "PUT",
      body: JSON.stringify({ metaMensal: valor }),
    });
    if (!resposta) return;
    if (!resposta.ok) throw new Error(await erroResposta(resposta, "Não foi possível salvar a meta."));
    const corpo = await resposta.json();
    metaMensal = Number(corpo.metaMensal);
    document.getElementById("form-meta").hidden = true;
    mostrarStatus("Meta mensal atualizada.");
    carregarVisao();
  } catch (erro) {
    mostrarStatus(erro.message || "Não foi possível salvar a meta.", true);
  }
}

async function iniciar() {
  try {
    const resultado = await Promise.all([
      buscarJson("/api/usuarios/meus-dados", "Não foi possível carregar o perfil."),
      buscarJson("/api/barbeiros", "Não foi possível carregar os profissionais."),
      buscarJson("/api/servicos", "Não foi possível carregar os serviços."),
      buscarJson("/api/agendamentos", "Não foi possível carregar os agendamentos."),
      buscarJson("/api/financeiro/meta-mensal", "Não foi possível carregar a meta mensal."),
      buscarJson("/api/barbearia", "Não foi possível carregar os horários de funcionamento."),
    ]);
    [perfil, barbeiros, servicos, agendamentos] = resultado;
    metaMensal = Number(resultado[4].metaMensal) || 10000;
    funcionamento = {
      horarioAbertura: resultado[5].horarioAbertura.slice(0, 5),
      horarioEncerramento: resultado[5].horarioEncerramento.slice(0, 5),
      diasFuncionamento: resultado[5].diasFuncionamento,
    };
    administrador = Permissoes.ehAdmin(perfil);
    document.getElementById("profile-name").textContent = perfil.nomeBarbearia || perfil.nome;
    popularFiltros();
    document.getElementById("btn-editar-meta").hidden = !administrador;
    document.getElementById("btn-editar-meta").addEventListener("click", () => {
      document.getElementById("form-meta").hidden = !document.getElementById("form-meta").hidden;
    });
    document.getElementById("form-meta").addEventListener("submit", salvarMeta);
    await carregarVisao();
  } catch (erro) {
    mostrarStatus(erro.message || "Não foi possível carregar os dados da visão geral.", true);
  }
}

document.getElementById("form-filtros").addEventListener("submit", (evento) => {
  evento.preventDefault();
  carregarVisao();
});
document.getElementById("btn-logout").addEventListener("click", (evento) => {
  evento.preventDefault();
  localStorage.removeItem("token");
  window.location.href = "login.html";
});

iniciar();
