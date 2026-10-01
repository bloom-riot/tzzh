import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import ChatPage from './pages/ChatPage/ChatPage';
import CardManagerPage from './pages/CardManagerPage/CardManagerPage';
import SettingsPage from './pages/SettingsPage/SettingsPage';
import NotFound from './pages/NotFound/NotFound';
import GlobalCallPanel from './components/CallPanel/GlobalCallPanel';
import { NewMessageToast } from './components/NewMessageToast/NewMessageToast';

const RoutesComponent = () => {
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ChatPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="cards" element={<CardManagerPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <GlobalCallPanel />
      <NewMessageToast />
    </>
  );
};

export default RoutesComponent;
