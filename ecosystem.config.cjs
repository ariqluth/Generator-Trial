module.exports = {
    apps: [{
        name: 'bbs-dev',
        script: 'server/index.js',
        watch: true,
        ignore_watch: [
            "**/*.mjs",      // abaikan semua file .mjs di seluruh project
            "server/logs",   // abaikan folder logs
            "server/logs/**", // abaikan semua file di folder logs
            "node_modules",
            "node_modules/**",
            "uploads",       // abaikan folder uploads
            "uploads/**",    // abaikan semua file di uploads
            "**/uploads",    // abaikan folder uploads di mana saja
            "**/uploads/**", // abaikan semua subfolder uploads
            "**/*.pdf",      // abaikan semua file PDF
            "**/*.jpeg",     // abaikan semua file JPEG
            "**/*.jpg",      // abaikan semua file JPG
            "**/*.png",      // abaikan semua file PNG
            "**/*.gif",      // abaikan semua file GIF
            "**/temp/**",    // abaikan folder temp
            "**/tmp/**"      // abaikan folder tmp
        ]
    }]
}