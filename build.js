({
  baseUrl: "assets/js/lib",
  name: "main",
  out: "assets/js/main-built.js",
  paths: {
      main: '../main',
      app: '../app'
  },
  map: {
      '*': { 'jquery': 'jquery-private' },
      'jquery-private': { 'jquery': 'jquery' }
  }
})
