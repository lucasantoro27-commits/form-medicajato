const express = require("express")
const fs = require("fs")
const cors = require("cors")
const XLSX = require("xlsx")

const app = express()
app.use(cors({
  origin: [
    "https://www.medicajatoapp.it",
    "https://medicajatoapp.it"
  ]
}))
app.use(express.json())

/* ===============================
SALVA ISCRIZIONE
================================ */

app.post("/api/iscrizione", (req,res)=>{

  const dati = req.body

  const linea = JSON.stringify({
    ...dati,
    data_invio: new Date().toISOString()
  }) + "\n"

  fs.appendFileSync("iscrizioni.json", linea)

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
