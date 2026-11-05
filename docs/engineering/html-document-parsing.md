# Normalização de documentos HTML

O passo 043 usa o `parse5` já instalado. `normalizeHtmlDocument` recebe HTML decodificado, URL de origem HTTPS, lista explícita de hosts exatos e limite de caracteres. Não faz requisição de rede nem grava conteúdo.

O parser procura `main`, `article` ou região de conteúdo e usa o corpo como fallback. Remove navegação, barras laterais, rodapé do site, scripts, estilos, formulários e trechos marcados `hidden`, `aria-hidden` ou com estilo inline oculto. Preserva o cabeçalho e o rodapé editorial dentro de um artigo, títulos `h1`–`h6`, parágrafos, listas e linhas de tabela. A saída mantém texto e seções com títulos para que trechos possam ser associados ao documento de origem.

Links de documentos são **candidatos**: o parser resolve `href` contra a URL de origem (ignora `<base>`), remove fragmentos e aceita apenas HTTPS no host exato fornecido pelo caller. O tipo é uma pista derivada do rótulo ou extensão, sem afirmar que o documento é pertinente. A exibição pública continua sujeita ao ADR 0014, com domínio revisado, fonte ativa e revisão humana. Rótulos de links fora da lista ainda podem aparecer no texto da página para preservar contexto, mas suas URLs não entram na lista de documentos.

A fixture `test/fixtures/documents/html/long-menu.v1.html` é sintética: cobre menu extenso, título e contexto editorial, tabela, anexos em hosts permitidos e links rejeitados. Portais que dependem de JavaScript, conteúdo em imagens, codificações não decodificadas e múltiplas áreas de conteúdo exigem avaliação por fonte nas etapas de integração.
