#!/usr/bin/env node

import axios from 'axios';
import { spawn } from 'child_process';

const BASE_URL = 'http://localhost:5000';
let serverProcess = null;
let accessToken = null;
let refreshToken = null;

// Configuration des couleurs pour les logs
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Démarrer le serveur
async function startServer() {
  return new Promise((resolve, reject) => {
    log('🚀 Démarrage du serveur...', 'blue');
    
    serverProcess = spawn('node', ['src/index.js'], {
      cwd: process.cwd(),
      stdio: 'pipe'
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Serveur démarré')) {
        log('✅ Serveur démarré avec succès', 'green');
        setTimeout(resolve, 1000); // Attendre 1s pour s'assurer que le serveur est prêt
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('Erreur serveur:', data.toString());
    });

    serverProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Le serveur s'est arrêté avec le code ${code}`));
      }
    });

    // Timeout de 10 secondes
    setTimeout(() => {
      reject(new Error('Timeout lors du démarrage du serveur'));
    }, 10000);
  });
}

// Arrêter le serveur
function stopServer() {
  if (serverProcess) {
    log('🛑 Arrêt du serveur...', 'yellow');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

// Fonction utilitaire pour les requêtes
async function makeRequest(method, url, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return {
      success: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 0,
      data: error.response?.data || { message: error.message }
    };
  }
}

// Tests des endpoints
async function runTests() {
  const tests = [];

  // 1. Test de santé
  log('\n📋 Test 1: Endpoint de santé', 'blue');
  const healthTest = await makeRequest('GET', '/health');
  if (healthTest.success && healthTest.status === 200) {
    log('✅ Health check: OK', 'green');
    tests.push({ name: 'Health Check', success: true });
  } else {
    log('❌ Health check: ÉCHEC', 'red');
    tests.push({ name: 'Health Check', success: false, error: healthTest.data });
  }

  // 2. Test de la documentation
  log('\n📋 Test 2: Documentation API', 'blue');
  const docsTest = await makeRequest('GET', '/api/docs');
  if (docsTest.success && docsTest.status === 200) {
    log('✅ Documentation API: OK', 'green');
    tests.push({ name: 'API Documentation', success: true });
  } else {
    log('❌ Documentation API: ÉCHEC', 'red');
    tests.push({ name: 'API Documentation', success: false, error: docsTest.data });
  }

  // 3. Test d'inscription
  log('\n📋 Test 3: Inscription utilisateur', 'blue');
  const registerData = {
    email: 'test@kaolack.sn',
    password: 'TestPass123',
    firstName: 'Jean',
    lastName: 'Dupont',
    phone: '771234567',
    address: 'Kaolack, Sénégal'
  };

  const registerTest = await makeRequest('POST', '/api/auth/register', registerData);
  if (registerTest.success && registerTest.status === 201) {
    log('✅ Inscription: OK', 'green');
    accessToken = registerTest.data.data.tokens.accessToken;
    refreshToken = registerTest.data.data.tokens.refreshToken;
    tests.push({ name: 'User Registration', success: true });
  } else {
    log('❌ Inscription: ÉCHEC', 'red');
    log(`Status: ${registerTest.status}, Message: ${JSON.stringify(registerTest.data)}`, 'red');
    tests.push({ name: 'User Registration', success: false, error: registerTest.data });
  }

  // 4. Test de connexion
  log('\n📋 Test 4: Connexion utilisateur', 'blue');
  const loginData = {
    email: 'test@kaolack.sn',
    password: 'TestPass123'
  };

  const loginTest = await makeRequest('POST', '/api/auth/login', loginData);
  if (loginTest.success && loginTest.status === 200) {
    log('✅ Connexion: OK', 'green');
    // Mettre à jour les tokens au cas où
    accessToken = loginTest.data.data.tokens.accessToken;
    refreshToken = loginTest.data.data.tokens.refreshToken;
    tests.push({ name: 'User Login', success: true });
  } else {
    log('❌ Connexion: ÉCHEC', 'red');
    tests.push({ name: 'User Login', success: false, error: loginTest.data });
  }

  // 5. Test du profil utilisateur (nécessite authentification)
  log('\n📋 Test 5: Récupération du profil', 'blue');
  const profileTest = await makeRequest('GET', '/api/auth/profile', null, {
    'Authorization': `Bearer ${accessToken}`
  });
  if (profileTest.success && profileTest.status === 200) {
    log('✅ Profil utilisateur: OK', 'green');
    tests.push({ name: 'User Profile', success: true });
  } else {
    log('❌ Profil utilisateur: ÉCHEC', 'red');
    tests.push({ name: 'User Profile', success: false, error: profileTest.data });
  }

  // 6. Test de la liste des services
  log('\n📋 Test 6: Liste des services', 'blue');
  const servicesTest = await makeRequest('GET', '/api/services');
  if (servicesTest.success && servicesTest.status === 200) {
    log('✅ Liste des services: OK', 'green');
    tests.push({ name: 'Services List', success: true });
  } else {
    log('❌ Liste des services: ÉCHEC', 'red');
    tests.push({ name: 'Services List', success: false, error: servicesTest.data });
  }

  // 7. Test du refresh token
  log('\n📋 Test 7: Refresh token', 'blue');
  const refreshTest = await makeRequest('POST', '/api/auth/refresh', {
    refreshToken: refreshToken
  });
  if (refreshTest.success && refreshTest.status === 200) {
    log('✅ Refresh token: OK', 'green');
    tests.push({ name: 'Token Refresh', success: true });
  } else {
    log('❌ Refresh token: ÉCHEC', 'red');
    tests.push({ name: 'Token Refresh', success: false, error: refreshTest.data });
  }

  // 8. Test de déconnexion
  log('\n📋 Test 8: Déconnexion', 'blue');
  const logoutTest = await makeRequest('POST', '/api/auth/logout', null, {
    'Authorization': `Bearer ${accessToken}`
  });
  if (logoutTest.success && logoutTest.status === 200) {
    log('✅ Déconnexion: OK', 'green');
    tests.push({ name: 'User Logout', success: true });
  } else {
    log('❌ Déconnexion: ÉCHEC', 'red');
    tests.push({ name: 'User Logout', success: false, error: logoutTest.data });
  }

  return tests;
}

// Fonction principale
async function main() {
  try {
    await startServer();
    
    log('\n🧪 Début des tests des endpoints...', 'yellow');
    const results = await runTests();
    
    // Résumé des résultats
    log('\n📊 Résumé des tests:', 'blue');
    const passed = results.filter(t => t.success).length;
    const failed = results.filter(t => !t.success).length;
    
    log(`✅ Tests réussis: ${passed}`, 'green');
    log(`❌ Tests échoués: ${failed}`, 'red');
    log(`📈 Taux de réussite: ${Math.round((passed / results.length) * 100)}%`, 'yellow');
    
    if (failed > 0) {
      log('\nDétails des échecs:', 'red');
      results.filter(t => !t.success).forEach(test => {
        log(`- ${test.name}: ${JSON.stringify(test.error)}`, 'red');
      });
    }
    
  } catch (error) {
    log(`❌ Erreur lors des tests: ${error.message}`, 'red');
  } finally {
    stopServer();
    process.exit(0);
  }
}

// Gestion des signaux pour arrêt propre
process.on('SIGINT', () => {
  log('\n🛑 Arrêt des tests...', 'yellow');
  stopServer();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopServer();
  process.exit(0);
});

// Lancement des tests
main().catch(error => {
  log(`❌ Erreur fatale: ${error.message}`, 'red');
  stopServer();
  process.exit(1);
});