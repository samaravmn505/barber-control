package com.barbearia.agendamento.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.math.BigDecimal;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor

public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String email;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String senha;

    private String nome;

    @Column(length = 20, unique = true)
    private String cpf;

    @Column(length = 20)
    private String telefone;

    private String nomeBarbearia;

    @Column(precision = 10, scale = 2)
    private BigDecimal metaMensal;

    private LocalTime horarioAbertura = LocalTime.of(8, 0);

    private LocalTime horarioEncerramento = LocalTime.of(20, 0);

    @Column(length = 20)
    private String diasFuncionamento = "1,2,3,4,5,6,7";

    @Column(length = 255)
    private String endereco;

    @Lob
    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private String foto;

    private String role;

    private Boolean consentimentoLgpd;

    private LocalDateTime dataConsentimento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "barbearia_id")
    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Usuario barbearia;
}