// Test simple de connexion et stockage token
async function testLogin() {
  console.log("🧪 Test de connexion et stockage token...")
  
  try {
    // Import dynamique de authService
    const authModule = await import('./lib/authService.js')
    const authService = authModule.default
    
    console.log("1. Test de connexion...")
    const loginResult = await authService.login({
      email: 'test@example.com',
      password: 'Test123!'
    })
    
    console.log("Résultat login:", loginResult)
    
    if (loginResult.success) {
      console.log("✅ Connexion réussie")
      
      // Vérifier le stockage
      console.log("2. Vérification du stockage...")
      const accessToken = localStorage.getItem('accessToken')
      const refreshToken = localStorage.getItem('refreshToken')
      const user = localStorage.getItem('user')
      
      console.log("- AccessToken stocké:", !!accessToken)
      console.log("- RefreshToken stocké:", !!refreshToken)  
      console.log("- User stocké:", !!user)
      
      if (accessToken) {
        console.log("- AccessToken (début):", accessToken.substring(0, 20) + "...")
      }
      
      if (user) {
        try {
          const parsedUser = JSON.parse(user)
          console.log("- User data:", parsedUser)
        } catch(e) {
          console.log("- User parse error:", e)
        }
      }
    } else {
      console.log("❌ Échec de connexion:", loginResult.error)
    }
    
  } catch (error) {
    console.error("❌ Erreur test:", error)
  }
}

// Exécuter le test si dans le navigateur
if (typeof window !== 'undefined') {
  testLogin()
} else {
  console.log("Ce test doit être exécuté dans le navigateur")
}