import { BrowserRouter, Route, Routes } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div className="p-10 text-2xl font-bold">SSAFER Frontend</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
