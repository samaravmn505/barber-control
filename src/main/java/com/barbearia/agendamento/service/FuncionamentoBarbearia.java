package com.barbearia.agendamento.service;

import com.barbearia.agendamento.model.Usuario;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.List;

@Component
public class FuncionamentoBarbearia {

    private static final LocalTime ABERTURA_PADRAO = LocalTime.of(8, 0);
    private static final LocalTime ENCERRAMENTO_PADRAO = LocalTime.of(20, 0);
    private static final List<Integer> DIAS_PADRAO = List.of(1, 2, 3, 4, 5, 6, 7);

    public LocalTime horarioAbertura(Usuario barbearia) {
        return barbearia.getHorarioAbertura() == null
                ? ABERTURA_PADRAO
                : barbearia.getHorarioAbertura();
    }

    public LocalTime horarioEncerramento(Usuario barbearia) {
        return barbearia.getHorarioEncerramento() == null
                ? ENCERRAMENTO_PADRAO
                : barbearia.getHorarioEncerramento();
    }

    public List<Integer> diasFuncionamento(Usuario barbearia) {
        String dias = barbearia.getDiasFuncionamento();
        if (dias == null || dias.isBlank()) {
            return DIAS_PADRAO;
        }
        try {
            return Arrays.stream(dias.split(","))
                    .map(String::trim)
                    .map(Integer::parseInt)
                    .distinct()
                    .sorted()
                    .toList();
        } catch (NumberFormatException erro) {
            throw new IllegalStateException("A configuração dos dias de funcionamento está inválida.", erro);
        }
    }

    public boolean atendeNoDia(Usuario barbearia, LocalDate data) {
        return diasFuncionamento(barbearia).contains(data.getDayOfWeek().getValue());
    }

    public boolean horarioPermitido(Usuario barbearia, LocalDateTime inicio, LocalDateTime fim) {
        return inicio != null
                && fim != null
                && inicio.toLocalDate().equals(fim.toLocalDate())
                && atendeNoDia(barbearia, inicio.toLocalDate())
                && !inicio.toLocalTime().isBefore(horarioAbertura(barbearia))
                && !fim.toLocalTime().isAfter(horarioEncerramento(barbearia));
    }

    public BarbeariaDados dados(Usuario barbearia) {
        return new BarbeariaDados(
                horarioAbertura(barbearia),
                horarioEncerramento(barbearia),
                diasFuncionamento(barbearia)
        );
    }

    public record BarbeariaDados(
            LocalTime horarioAbertura,
            LocalTime horarioEncerramento,
            List<Integer> diasFuncionamento
    ) {
    }
}
