const express = require("express")
const fs = require("fs")
const cors = require("cors")
const XLSX = require("xlsx")
const nodemailer = require("nodemailer")

const app = express()

app.use(cors({
  origin: [
    "https://www.medicajatoapp.it",
    "https://medicajatoapp.it"
  ]
}))

app.use(express.json())

const path = require("path")

/* 🔥 SERVE FILE COMUNI */
app.get("/comuni.json", (req,res)=>{
  res.sendFile(path.join(__dirname, "comuni.json"))
})

/* ===============================
CONFIG EMAIL (BREVO)
================================ */

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
})
console.log("MAIL_USER:", process.env.MAIL_USER)
console.log("MAIL_PASS:", process.env.MAIL_PASS ? "OK" : "MANCANTE")
/* ===============================
SALVA ISCRIZIONE + EMAIL
================================ */

app.post("/api/iscrizione", async (req,res)=>{

  const dati = req.body

  const linea = JSON.stringify({
    ...dati,
    data_invio: new Date().toISOString()
  }) + "\n"

  fs.appendFileSync("iscrizioni.json", linea)

  /* 🔥 INVIO EMAIL */
  try {

    await transporter.sendMail({
      from: "Medicajato <info@medicajato.it>",
      to: "amministrazione@medicajato.it",
      subject: "Nuova iscrizione evento",
      html: `
        <h3>Nuova iscrizione evento</h3>

        <b>Nome:</b> ${dati.nome}<br/>
        <b>Cognome:</b> ${dati.cognome}<br/>
        <b>Codice Fiscale:</b> ${dati.codice_fiscale}<br/>
        <b>Email:</b> ${dati.email || "-"}<br/>
        <b>Telefono:</b> ${dati.telefono || "-"}<br/>
        <b>Evento:</b> ${dati.evento}<br/>

        <br/>
        <small>Data invio: ${new Date().toLocaleString("it-IT")}</small>
      `
    })

    console.log("📧 Email inviata")

  } catch (err) {

    console.error("❌ Errore invio email:", err.message)

  }

  res.json({ success:true })

})

/* ===============================
EXPORT EXCEL
================================ */

app.get("/api/export", (req,res)=>{

  if(!fs.existsSync("iscrizioni.json")){
    return res.status(404).send("Nessun dato")
  }

  const raw = fs.readFileSync("iscrizioni.json","utf8")

  const data = raw
    .trim()
    .split("\n")
    .map(r => JSON.parse(r))

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(wb, ws, "Iscrizioni")

  const file = XLSX.write(wb, {
    type:"buffer",
    bookType:"xlsx"
  })

  res.setHeader(
    "Content-Disposition",
    "attachment; filename=iscrizioni.xlsx"
  )

  res.send(file)

})

/* ===============================
SERVER
================================ */

const PORT = process.env.PORT || 3000

app.listen(PORT, ()=>{
  console.log("Server attivo su porta", PORT)
})
