import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext.jsx'
import { DataProvider } from './lib/DataContext.jsx'
import Layout from './components/Layout.jsx'
import RotaProtegida from './components/RotaProtegida.jsx'
import Inicio from './pages/Inicio.jsx'
import Login from './pages/Login.jsx'
import NovaOcorrencia from './pages/NovaOcorrencia.jsx'
import Consulta from './pages/Consulta.jsx'
import Painel from './pages/Painel.jsx'
import Placa from './pages/Placa.jsx'
import Visao from './pages/Visao.jsx'
import Relatos from './pages/Relatos.jsx'
import Corpus from './pages/Corpus.jsx'
import Robo from './pages/Robo.jsx'
import InovaBot from './pages/InovaBot.jsx'
import Admin from './pages/Admin.jsx'
import Sobre from './pages/Sobre.jsx'

function NaoEncontrada() {
  return (
    <section className="pagina estreita">
      <h1>Página não encontrada</h1>
      <p>O endereço não existe. Use o menu para voltar ao início.</p>
    </section>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <DataProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Inicio />} />
              <Route path="/login" element={<Login />} />
              <Route path="/nova" element={<RotaProtegida><NovaOcorrencia /></RotaProtegida>} />
              <Route path="/consulta" element={<Consulta />} />
              <Route path="/painel" element={<Painel />} />
              <Route path="/robo" element={<Robo />} />
              <Route path="/placa" element={<Placa />} />
              <Route path="/imagens" element={<Visao />} />
              <Route path="/relatos" element={<Relatos />} />
              <Route path="/corpus" element={<Corpus />} />
              <Route path="/inovabot" element={<InovaBot />} />
              <Route path="/admin" element={<RotaProtegida papel="admin"><Admin /></RotaProtegida>} />
              <Route path="/sobre" element={<Sobre />} />
              <Route path="/inicio" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NaoEncontrada />} />
            </Routes>
          </Layout>
        </DataProvider>
      </AuthProvider>
    </HashRouter>
  )
}
