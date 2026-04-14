import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import Navbar from "./app/components/Navbar.tsx";
import Home from "./app/pages/Home.tsx";
import Observatory from "./app/pages/Observatory.tsx";
import PlanetDetail from "./app/pages/PlanetDetail.tsx";
import AddPlanet from "./app/pages/AddPlanet.tsx";
import Gallery from "./app/pages/Gallery.tsx";
import SystemView from "./app/pages/SystemView.tsx";
import Analytics from "./app/pages/Analytics.tsx";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Navbar />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/observatory" element={<Observatory />} />
      <Route path="/add-planet" element={<AddPlanet />} />
      <Route path="/planet/:id" element={<PlanetDetail />} />
      <Route path="/analytics" element={<Analytics />} />
      {/* Legacy routes */}
      <Route path="/gallery" element={<Gallery />} />
      <Route path="/system/:id" element={<SystemView />} />
    </Routes>
  </BrowserRouter>
);