import { useAuth } from '../lib/AuthContext.jsx'
import { useNavigate } from 'react-router-dom'

const ODS = [
  ['ODS 11', 'Cidades e comunidades sustentáveis', 'Ajuda a levar problemas de infraestrutura urbana a quem pode corrigi-los, com transparência no andamento.'],
  ['ODS 9', 'Indústria, inovação e infraestrutura', 'Usa triagem automática para organizar relatos e apoiar a manutenção da infraestrutura.'],
  ['ODS 16', 'Paz, justiça e instituições eficazes', 'Dá ao cidadão um canal para acompanhar o que foi feito e deixa o rastro de cada decisão.'],
]

export default function Sobre() {
  const { usuario, excluirConta } = useAuth()
  const nav = useNavigate()
  return (
    <section className="pagina">
      <h1>Sobre, privacidade e ODS</h1>

      <h2>O problema</h2>
      <p>Muitos problemas urbanos são vistos todos os dias por quem mora na cidade, mas chegam tarde, repetidos ou incompletos a quem poderia resolver. A InovaCity recebe esses relatos, organiza e mostra o andamento.</p>

      <h2>Objetivos de Desenvolvimento Sustentável</h2>
      <ul className="odslista">
        {ODS.map(([n, t, d]) => <li key={n} className="cartao"><h3>{n}: {t}</h3><p>{d}</p></li>)}
      </ul>

      <h2>Como tratamos seus dados</h2>
      <ul className="lista-simples">
        <li>Coletamos só nome, e-mail, o texto do relato e, se você quiser, localização e foto.</li>
        <li>Tudo fica no armazenamento deste navegador. Nada é enviado a um servidor nesta versão.</li>
        <li>A senha é guardada como resumo criptográfico com sal (PBKDF2), nunca em texto.</li>
        <li>Listas e painéis não mostram o nome de quem relatou.</li>
        <li>Você pode excluir sua conta a qualquer momento. Seus relatos continuam sem identificação pessoal.</li>
        <li>Pedimos consentimento no cadastro e orientamos a não escrever dados de terceiros no relato.</li>
      </ul>
      {usuario && !usuario.demo && (
        <p><button type="button" className="btn sec" onClick={() => { if (window.confirm('Excluir sua conta? Esta ação não pode ser desfeita.')) { excluirConta(); nav('/') } }}>Excluir minha conta</button></p>
      )}

      <h2>Acessibilidade</h2>
      <p>Há link para pular ao conteúdo, navegação por teclado, rótulos em todos os campos, estados sempre em texto (não só cor), ajuste do tamanho da letra e modo de alto contraste na barra do topo. As animações respeitam a preferência do sistema por menos movimento.</p>

      <h2>Limites desta versão</h2>
      <ul className="lista-simples">
        <li>Protótipo acadêmico: o login é local e não substitui autenticação em servidor.</li>
        <li>O encaminhamento aos órgãos é simulado. Parcerias e canais reais ainda não existem.</li>
        <li>O classificador foi treinado com dados sintéticos e pode errar; por isso há revisão humana.</li>
        <li>O mapa é esquemático, não um mapa de ruas.</li>
        <li>Os dados da demonstração são fictícios.</li>
      </ul>
    </section>
  )
}
