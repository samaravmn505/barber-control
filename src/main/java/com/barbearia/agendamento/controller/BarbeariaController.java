package com.barbearia.agendamento.controller;

import com.barbearia.agendamento.dto.BarbeariaRequest;
import com.barbearia.agendamento.dto.BarbeariaResponse;
import com.barbearia.agendamento.model.Usuario;
import com.barbearia.agendamento.repository.UsuarioRepository;
import com.barbearia.agendamento.service.ContextoUsuario;
import com.barbearia.agendamento.service.FuncionamentoBarbearia;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/barbearia")
public class BarbeariaController {

    private static final Pattern FOTO_VALIDA = Pattern.compile("^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$");
    private static final int TAMANHO_MAXIMO_FOTO = 2_800_000;

    private final UsuarioRepository usuarioRepository;
    private final ContextoUsuario contexto;
    private final FuncionamentoBarbearia funcionamento;

    public BarbeariaController(UsuarioRepository usuarioRepository,
                               ContextoUsuario contexto,
                               FuncionamentoBarbearia funcionamento) {
        this.usuarioRepository = usuarioRepository;
        this.contexto = contexto;
        this.funcionamento = funcionamento;
    }

    private BarbeariaResponse resposta(Usuario barbearia) {
        var dados = funcionamento.dados(barbearia);
        return new BarbeariaResponse(
                barbearia.getNomeBarbearia(),
                barbearia.getEndereco(),
                barbearia.getFoto(),
                dados.horarioAbertura(),
                dados.horarioEncerramento(),
                dados.diasFuncionamento()
        );
    }

    @GetMapping
    public ResponseEntity<?> buscar(Authentication authentication) {
        var ctx = contexto.de(authentication);
        return usuarioRepository.findById(ctx.barbeariaId())
                .<ResponseEntity<?>>map(b -> ResponseEntity.ok(resposta(b)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping
    public ResponseEntity<?> atualizar(@RequestBody BarbeariaRequest request, Authentication authentication) {
        var ctx = contexto.de(authentication);
        Usuario barbearia = ctx.usuario();
        boolean atualizaFuncionamento = request.horarioAbertura() != null
                || request.horarioEncerramento() != null
                || request.diasFuncionamento() != null;

        if (atualizaFuncionamento && !ctx.admin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("erro", "Somente o administrador pode alterar o funcionamento da barbearia."));
        }
        if (atualizaFuncionamento) {
            if (request.horarioAbertura() == null || request.horarioEncerramento() == null
                    || request.diasFuncionamento() == null
                    || !request.horarioAbertura().isBefore(request.horarioEncerramento())) {
                return ResponseEntity.badRequest().body(Map.of("erro", "Informe um intervalo de horários válido."));
            }
            List<Integer> dias = request.diasFuncionamento();
            if (dias.isEmpty() || dias.stream().anyMatch(dia -> dia == null || dia < 1 || dia > 7)
                    || dias.stream().distinct().count() != dias.size()) {
                return ResponseEntity.badRequest().body(Map.of("erro", "Selecione ao menos um dia válido da semana."));
            }
            barbearia.setHorarioAbertura(request.horarioAbertura());
            barbearia.setHorarioEncerramento(request.horarioEncerramento());
            barbearia.setDiasFuncionamento(dias.stream().sorted()
                    .map(String::valueOf).collect(java.util.stream.Collectors.joining(",")));
        }

        if (request.endereco() != null) {
            String endereco = request.endereco().trim();
            if (endereco.length() > 255) {
                return ResponseEntity.badRequest().body(Map.of("erro", "O endereço deve ter até 255 caracteres."));
            }
            barbearia.setEndereco(endereco.isEmpty() ? null : endereco);
        }

        if (request.foto() != null) {
            if (request.foto().isEmpty()) {
                barbearia.setFoto(null);
            } else if (request.foto().length() > TAMANHO_MAXIMO_FOTO
                    || !FOTO_VALIDA.matcher(request.foto()).matches()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("erro", "Foto inválida. Use PNG, JPEG ou WEBP de até 2 MB."));
            } else {
                barbearia.setFoto(request.foto());
            }
        }

        usuarioRepository.save(barbearia);
        return ResponseEntity.ok(resposta(barbearia));
    }
}