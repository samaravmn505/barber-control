package com.barbearia.agendamento.service;

import com.barbearia.agendamento.model.Usuario;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FuncionamentoBarbeariaTests {

    private final FuncionamentoBarbearia funcionamento = new FuncionamentoBarbearia();

    @Test
    void aplicaPadraoAConfiguracoesLegadasSemHorarioDefinido() {
        Usuario barbearia = new Usuario();
        barbearia.setHorarioAbertura(null);
        barbearia.setHorarioEncerramento(null);
        barbearia.setDiasFuncionamento(null);

        assertEquals(LocalTime.of(8, 0), funcionamento.horarioAbertura(barbearia));
        assertEquals(LocalTime.of(20, 0), funcionamento.horarioEncerramento(barbearia));
        assertEquals(List.of(1, 2, 3, 4, 5, 6, 7), funcionamento.diasFuncionamento(barbearia));
    }

    @Test
    void permiteSomenteDiasEIntervalosConfiguradosIncluindoDuracaoDoServico() {
        Usuario barbearia = new Usuario();
        barbearia.setHorarioAbertura(LocalTime.of(9, 0));
        barbearia.setHorarioEncerramento(LocalTime.of(17, 0));
        barbearia.setDiasFuncionamento("1,2,3,4,5");

        assertTrue(funcionamento.horarioPermitido(
                barbearia,
                LocalDate.of(2026, 11, 16).atTime(16, 0),
                LocalDate.of(2026, 11, 16).atTime(17, 0)));
        assertFalse(funcionamento.horarioPermitido(
                barbearia,
                LocalDateTime.of(2026, 11, 16, 16, 30),
                LocalDateTime.of(2026, 11, 16, 17, 30)));
        assertFalse(funcionamento.horarioPermitido(
                barbearia,
                LocalDate.of(2026, 11, 15).atTime(10, 0),
                LocalDate.of(2026, 11, 15).atTime(10, 30)));
    }
}
