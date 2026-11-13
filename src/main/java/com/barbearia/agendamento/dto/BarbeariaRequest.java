package com.barbearia.agendamento.dto;

import java.time.LocalTime;
import java.util.List;

public record BarbeariaRequest(
        String endereco,
        String foto,
        LocalTime horarioAbertura,
        LocalTime horarioEncerramento,
        List<Integer> diasFuncionamento
) {
}