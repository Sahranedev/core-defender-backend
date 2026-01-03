import { io, Socket } from 'socket.io-client';

// Configuration de la connexion
const SOCKET_URL =
  process.env.SOCKET_URL || process.env.API_URL || 'http://localhost:3000';

// Création du client avec typage
const socket: Socket = io(SOCKET_URL);

// ÉTAPE 1 : Gestion de la connexion
socket.on('connect', () => {
  console.log('✅ Connexion réussie au Gateway !');
  console.log('Socket ID:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('❌ Erreur de connexion:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Déconnexion:', reason);
});

// ÉTAPE 2 : Écoute des réponses du serveur

// Écouter l'accusé de réception du Gateway
socket.on('sensor_data', (response) => {
  console.log('Réponse du Gateway:', response);
});

// ÉTAPE 3 : Envoi de données de test

function sendNormalData() {
  const normalPayload = {
    machineCode: 'COMP-01',
    status: 'running',
    sensors: {
      temperature: 65,
      pression: 60,
      vibration: 0.2,
    },
    timestamp: new Date().toISOString(),
  };

  console.log(' Envoi de données NORMALES...');
  console.log(normalPayload);

  socket.emit('sensor_data', normalPayload);
}

function sendCriticalData() {
  const criticalPayload = {
    machineCode: 'CONV-02',
    status: 'degraded',
    sensors: {
      vitesse: 105,
      charge: 110,
    },
  };
  console.log('Envoi de données CRITIQUES:', criticalPayload);

  socket.emit('sensor_data', criticalPayload);
}

// Attendre 2 secondes après la connexion avant d'envoyer
setTimeout(() => {
  if (socket.connected) {
    sendNormalData();
    sendCriticalData();
  }
}, 2000);
