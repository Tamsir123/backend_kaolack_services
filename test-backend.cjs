// Script de test pour vérifier les routes du backend
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testRoutes() {
  try {
    console.log('=== TEST DES ROUTES BACKEND ===\n');

    // 1. Tester la route des services
    console.log('1. Test GET /api/services');
    const servicesResponse = await axios.get(`${BASE_URL}/services`);
    console.log('✅ Services OK:', servicesResponse.data.services?.length, 'services trouvés\n');

    // 2. Test d'inscription pour avoir un token
    console.log('2. Test POST /api/auth/register');
    const timestamp = Date.now();
    const registerData = {
      firstName: 'Test',
      lastName: 'User', 
      email: `test${timestamp}@example.com`,
      password: 'password123',
      phone: `+22170${timestamp.toString().slice(-7)}`,
      address: 'Test Address'
    };

    let token = null;
    try {
      const registerResponse = await axios.post(`${BASE_URL}/auth/register`, registerData);
      token = registerResponse.data.token;
      console.log('✅ Inscription OK, token obtenu\n');
    } catch (err) {
      // L'utilisateur existe peut-être déjà, essayons de se connecter
      console.log('⚠️  Utilisateur existe, tentative de connexion...');
      try {
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
          email: registerData.email,
          password: registerData.password
        });
        token = loginResponse.data.token;
        console.log('✅ Connexion OK, token obtenu\n');
      } catch (loginErr) {
        console.error('❌ Erreur connexion:', loginErr.response?.data || loginErr.message);
        return;
      }
    }

    // 3. Test de la route d'extrait de naissance
    console.log('3. Test POST /api/services/birth-certificate/request');
    const birthCertData = {
      firstName: 'Jean',
      lastName: 'Dupont',
      phone: '+221701234567',
      email: 'jean@example.com',
      address: '123 Rue Test, Kaolack',
      idNumber: 'CNI1234567890',
      birthDate: '1990-01-15',
      birthPlace: 'Kaolack',
      fatherName: 'Pierre Dupont',
      motherName: 'Marie Diallo',
      purpose: 'Inscription scolaire',
      urgency: 'normal',
      deliveryMethod: 'pickup',
      additionalInfo: 'Test de demande'
    };

    const birthCertResponse = await axios.post(
      `${BASE_URL}/services/birth-certificate/request`, 
      birthCertData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Demande extrait de naissance OK:', birthCertResponse.data);

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
  }
}

testRoutes();