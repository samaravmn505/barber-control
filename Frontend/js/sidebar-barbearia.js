(() => {
  const notificationsBadge = document.querySelector(".notification-badge");
  const avatarEl = document.querySelector(".profile-avatar");
  const profileNameEl = document.querySelector(".profile-name");
  if (!avatarEl && !notificationsBadge) return;

  if (avatarEl) {
    const iconEl = avatarEl.querySelector("i");
    let fotoEl = avatarEl.querySelector("img");

    window.atualizarFotoSidebar = (foto) => {
      if (!foto) {
        if (fotoEl) fotoEl.style.display = "none";
        if (iconEl) iconEl.style.display = "";
        return;
      }

      if (!fotoEl) {
        fotoEl = document.createElement("img");
        fotoEl.alt = "Foto da barbearia";
        fotoEl.addEventListener("error", () => {
          fotoEl.style.display = "none";
          if (iconEl) iconEl.style.display = "";
          console.error("Não foi possível exibir a foto da barbearia na sidebar.");
        });
        avatarEl.appendChild(fotoEl);
      }

      fotoEl.src = foto;
      fotoEl.style.display = "block";
      if (iconEl) iconEl.style.display = "none";
    };

    async function carregarFotoSidebar() {
      try {
        const resposta = await apiFetch("/api/barbearia");
        if (!resposta) return;
        if (!resposta.ok) {
          console.error(`Não foi possível carregar a foto da barbearia: HTTP ${resposta.status}.`);
          return;
        }

        const dados = await resposta.json();
        if (profileNameEl && dados.nomeBarbearia) {
          profileNameEl.textContent = dados.nomeBarbearia;
        }
        window.atualizarFotoSidebar(dados.foto);
      } catch (erro) {
        console.error("Não foi possível carregar a foto da barbearia na sidebar.", erro);
      }
    }

    carregarFotoSidebar();
  }

  async function carregarContagemNotificacoes() {
    if (!notificationsBadge) return;
    try {
      const resposta = await apiFetch("/api/agendamentos/notificacoes");
      if (!resposta) return;
      if (!resposta.ok) {
        console.error(`Não foi possível carregar as notificações: HTTP ${resposta.status}.`);
        return;
      }

      const notificacoes = await resposta.json();
      const naoLidas = notificacoes.filter((notificacao) => !notificacao.lida).length;
      notificationsBadge.textContent = naoLidas > 99 ? "99+" : String(naoLidas);
      notificationsBadge.hidden = naoLidas === 0;
      notificationsBadge.setAttribute(
        "aria-label",
        `${naoLidas} notificações não lidas`,
      );
    } catch (erro) {
      console.error("Não foi possível carregar a contagem de notificações.", erro);
    }
  }

  window.atualizarContagemNotificacoes = carregarContagemNotificacoes;
  carregarContagemNotificacoes();
})();
