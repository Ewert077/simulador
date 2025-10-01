document.addEventListener("DOMContentLoaded", () => {
    // Elementos do DOM
    const valorImovelInput = document.getElementById("valorImovel");
    const rendaBrutaInput = document.getElementById("rendaBruta");
    const prazoInput = document.getElementById("prazo");
    const idadeInput = document.getElementById("idade");
    const fgtsInput = document.getElementById("fgts");
    const dependentesSelect = document.getElementById("dependentes");
    const calcularButton = document.getElementById("calcular");

    // Elementos de resultado
    const valorFinanciadoSpan = document.getElementById("valorFinanciado");
    const parcelaMensalSpan = document.getElementById("parcelaMensal");
    const subsidioSpan = document.getElementById("subsidio");
    const entradaSpan = document.getElementById("entrada");
    const taxaJurosSpan = document.getElementById("taxaJuros");
    const valorTotalSpan = document.getElementById("valorTotal");

    let tabelaFinanciamento = [];

    // Carregar os dados de financiamento do arquivo JSON
    fetch("financing_data.json")
        .then(response => response.json())
        .then(data => {
            tabelaFinanciamento = data;
            console.log("Dados da tabela de financiamento carregados:", tabelaFinanciamento.length, "registros");
        })
        .catch(error => {
            console.error("Erro ao carregar os dados de financiamento:", error);
            alert("Erro ao carregar os dados de financiamento. Verifique se o arquivo financing_data.json está disponível.");
        });

    // Função para formatar valores em moeda brasileira
    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    }

    // Função para formatar percentual
    function formatPercentage(value) {
        return (value * 100).toFixed(2) + '%';
    }

    // Função para validar entrada
    function validateInput(input, min = 0, max = Infinity) {
        const value = parseFloat(input.value);
        if (isNaN(value) || value < min || value > max) {
            input.classList.add('error');
            return false;
        }
        input.classList.remove('error');
        return true;
    }

    // Função para encontrar a faixa de financiamento
    function encontrarFaixaFinanciamento(rendaBruta) {
        // Ordenar a tabela por renda para garantir busca correta
        tabelaFinanciamento.sort((a, b) => a.renda - b.renda);
        
        // Encontrar a primeira faixa onde a renda é menor ou igual à renda da faixa
        let faixaEncontrada = tabelaFinanciamento.find(faixa => rendaBruta <= faixa.renda);
        
        // Se a renda for maior que a última faixa, usar a última faixa
        if (!faixaEncontrada && tabelaFinanciamento.length > 0) {
            faixaEncontrada = tabelaFinanciamento[tabelaFinanciamento.length - 1];
        }
        
        return faixaEncontrada;
    }

    // Função principal de cálculo
    function calcularSimulacao() {
        // Validar entradas
        const isValidValorImovel = validateInput(valorImovelInput, 1000);
        const isValidRendaBruta = validateInput(rendaBrutaInput, 100);
        const isValidPrazo = validateInput(prazoInput, 12, 420);
        const isValidIdade = validateInput(idadeInput, 18, 80);
        const isValidFgts = validateInput(fgtsInput, 0);

        if (!isValidValorImovel || !isValidRendaBruta || !isValidPrazo || !isValidIdade || !isValidFgts) {
            alert("Por favor, corrija os valores destacados em vermelho.");
            return;
        }

        // Obter valores dos inputs
        const valorImovel = parseFloat(valorImovelInput.value);
        const rendaBruta = parseFloat(rendaBrutaInput.value);
        const prazo = parseInt(prazoInput.value);
        const idade = parseInt(idadeInput.value);
        const fgts = parseFloat(fgtsInput.value);
        const temDependentes = dependentesSelect.value === "true";

        // Verificar se os dados da tabela foram carregados
        if (tabelaFinanciamento.length === 0) {
            alert("Dados de financiamento não carregados. Tente novamente em alguns segundos.");
            return;
        }

        // Encontrar a faixa de financiamento correspondente à renda
        const faixaFinanciamento = encontrarFaixaFinanciamento(rendaBruta);

        if (!faixaFinanciamento) {
            alert("Não foi encontrada uma faixa de financiamento para a renda informada.");
            return;
        }

        console.log("Faixa de financiamento encontrada:", faixaFinanciamento);

        // Calcular valores baseados na lógica da planilha
        
        // 1. Valor Financiado: limitado pelo valor máximo da faixa e pelo valor do imóvel
        let valorFinanciado = Math.min(faixaFinanciamento.valor_max_financiado, valorImovel * 0.9); // Máximo 90% do valor do imóvel
        
        // 2. Subsídio: baseado na faixa e se tem dependentes
        let subsidio = temDependentes ? faixaFinanciamento.subsidio_com_dependente : faixaFinanciamento.subsidio_sem_dependente;
        
        // 3. Entrada: Fórmula da planilha = Valor do Imóvel - Valor Financiado - Subsídio - FGTS
        let entrada = valorImovel - valorFinanciado - subsidio - fgts;
        
        // Ajustar se a entrada for negativa
        if (entrada < 0) {
            // Se a entrada calculada for negativa, ajustar o valor financiado
            valorFinanciado = valorImovel - subsidio - fgts;
            if (valorFinanciado < 0) valorFinanciado = 0;
            entrada = 0;
        }
        
        // Garantir que o valor financiado não exceda o limite da faixa
        if (valorFinanciado > faixaFinanciamento.valor_max_financiado) {
            const diferenca = valorFinanciado - faixaFinanciamento.valor_max_financiado;
            valorFinanciado = faixaFinanciamento.valor_max_financiado;
            entrada += diferenca;
        }

        // 4. Calcular parcela mensal usando a fórmula PMT
        const taxaJurosMensal = faixaFinanciamento.taxa_juros / 12;
        let parcelaMensal = 0;
        
        if (valorFinanciado > 0) {
            if (taxaJurosMensal > 0) {
                // Fórmula PMT: PMT = PV * (i * (1 + i)^n) / ((1 + i)^n - 1)
                const fatorJuros = Math.pow(1 + taxaJurosMensal, prazo);
                parcelaMensal = valorFinanciado * (taxaJurosMensal * fatorJuros) / (fatorJuros - 1);
            } else {
                // Se taxa de juros for 0, divisão simples
                parcelaMensal = valorFinanciado / prazo;
            }
        }

        // 5. Valor total a pagar
        const valorTotal = (parcelaMensal * prazo) + entrada + subsidio;

        // Verificar se a parcela não excede 30% da renda (regra comum de financiamento)
        const percentualRenda = (parcelaMensal / rendaBruta) * 100;
        if (percentualRenda > 30) {
            alert(`Atenção: A parcela representa ${percentualRenda.toFixed(1)}% da sua renda. O recomendado é no máximo 30%.`);
        }

        // Atualizar a interface com os resultados
        valorFinanciadoSpan.textContent = formatCurrency(valorFinanciado);
        parcelaMensalSpan.textContent = formatCurrency(parcelaMensal);
        subsidioSpan.textContent = formatCurrency(subsidio);
        entradaSpan.textContent = formatCurrency(entrada);
        taxaJurosSpan.textContent = formatPercentage(faixaFinanciamento.taxa_juros);
        valorTotalSpan.textContent = formatCurrency(valorTotal);

        // Animar a seção de resultados
        const resultsSection = document.querySelector('.results-section');
        resultsSection.style.animation = 'none';
        resultsSection.offsetHeight; // Trigger reflow
        resultsSection.style.animation = 'fadeIn 0.5s ease';
    }

    // Event listener para o botão calcular
    calcularButton.addEventListener("click", calcularSimulacao);

    // Event listeners para validação em tempo real
    [valorImovelInput, rendaBrutaInput, prazoInput, idadeInput, fgtsInput].forEach(input => {
        input.addEventListener('blur', () => {
            validateInput(input);
        });
        
        input.addEventListener('input', () => {
            input.classList.remove('error');
        });
    });

    // Permitir cálculo com Enter
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            calcularSimulacao();
        }
    });
});

