import { useState } from 'react';

import {Routes, Route} from "react-router-dom";
import Sidebar from './components/layout/sidebar.jsx';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import AISupport from './pages/Support/AISupport.jsx';
import Journal from "./pages/Journal/Journal";
import Insights from "./pages/Insights/Insights";
import Settings from "./pages/Settings/Settings";


function App() {
  return (
    <div className="flex min-h-screen bg-background">
      
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className='flex-1'>
        <Routes>
          <Route path='/' element={<Dashboard/>}/>
          <Route path='/dashboard' element={<Dashboard/>}/>
          <Route path='/support' element={<AISupport/>}/>
          <Route path='/journal' element={<Journal/>}/>
          <Route path='/insights' element={<Insights/>}/>
          <Route path='/settings' element={<Settings/>}/>
          
        </Routes>

      </div>
    
    </div>
  );
}

export default App
