const express = require("express")
const fs = require("fs")
const cors = require("cors")
const XLSX = require("xlsx")
const nodemailer = require("nodemailer")

const app = express()

app.use(cors({
  origin: [
    "https://www.medicajatoapp.it",
    "https://medicajatoapp.it",
    "https://localhost:5173",
    "http://localhost:5173",
    "http://localhost:3002"
  ]
}))

app.get("/api/iscrizioni-studio",(req,res)=>{

  if(!fs.existsSync("iscrizioni.json")){
    return res.json([]);
  }

  const rows = fs
    .readFileSync("iscrizioni.json","utf8")
    .split("\n")
    .filter(Boolean)
    .map(r => JSON.parse(r));

  const studio = rows.filter(
    r =>
      String(r.destinazione || "")
        .trim()
        .toLowerCase() === "studio"
      &&
      r.stato_importazione !== "importata"
  );

  res.json(studio);

});

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

  const crypto = require("crypto")

dati.id =
  crypto.randomUUID()

dati.stato_importazione =
  dati.stato_importazione || "da_importare"

dati.data_invio =
  new Date().toISOString()

  const eventiCorsi = [
  "bls",
  "ecg",
  "info",
  "elettrofisiologia",
  "accessi_vascolari",
  "eventi"
]

dati.destinazione =
  eventiCorsi.includes(dati.evento)
    ? "corsi"
    : "studio"

  const linea =
  JSON.stringify(dati)
  + "\n"

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
  
  <b>Data nascita:</b> ${dati.data_nascita || "-"}<br/>
  <b>Sesso:</b> ${dati.sesso || "-"}<br/>
  
  <b>Codice Fiscale:</b> ${dati.codice_fiscale}<br/>
  
  <b>Comune nascita:</b> ${dati.comune_nascita || "-"}<br/>
  
  <b>Indirizzo:</b> ${dati.indirizzo || "-"}<br/>
  <b>Comune residenza:</b> ${dati.comune_residenza || "-"}<br/>
  
  <b>Email:</b> ${dati.email || "-"}<br/>
  <b>Telefono:</b> ${dati.telefono || "-"}<br/>
  
  <b>Evento:</b> ${dati.evento}<br/>

  <br/>
  <small>Data invio: ${new Date().toLocaleString("it-IT")}</small>
  
  <b>Note / Orario preferito:</b> ${dati.note || "-"}<br/>
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

app.get("/api/iscrizioni",(req,res)=>{

  if(!fs.existsSync("iscrizioni.json")){
    return res.json([])
  }

  const rows = fs
    .readFileSync("iscrizioni.json","utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(r => JSON.parse(r))

  res.json(rows)

})

app.get("/api/iscrizioni/:dest",(req,res)=>{

  const dest = req.params.dest;

  if(!fs.existsSync("iscrizioni.json")){
    return res.json([]);
  }

  const rows = fs
    .readFileSync("iscrizioni.json","utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(r => JSON.parse(r))
    .filter(
      r =>
        r.destinazione === dest &&
        r.stato_importazione !== "importata"
    );

  res.json(rows);

});

app.post(
  "/api/iscrizioni/:id/importata",
  (req,res)=>{

    if(!fs.existsSync("iscrizioni.json")){
      return res.status(404).json({
        success:false,
        error:"Archivio non trovato"
      });
    }

    const rows = fs
      .readFileSync(
        "iscrizioni.json",
        "utf8"
      )
      .split("\n")
      .filter(Boolean)
      .map(r => JSON.parse(r));

    let trovato = false;

    const updated = rows.map(r => {

      if(r.id === req.params.id){

        trovato = true;

        r.stato_importazione =
          "importata";

        r.data_importazione =
          new Date().toISOString();
      }

      return r;
    });

    fs.writeFileSync(
      "iscrizioni.json",
      updated
        .map(r => JSON.stringify(r))
        .join("\n")
      + "\n"
    );

    res.json({
      success:trovato
    });

});

app.get(
  "/api/iscrizioni/id/:id",
  (req,res)=>{

    if(!fs.existsSync("iscrizioni.json")){
      return res.status(404).json(null);
    }

    const rows = fs
      .readFileSync(
        "iscrizioni.json",
        "utf8"
      )
      .split("\n")
      .filter(Boolean)
      .map(r => JSON.parse(r));

    const item = rows.find(
      r => r.id === req.params.id
    );

    res.json(item || null);

});

app.get(
  "/api/dashboard",
  (req,res)=>{

    if(!fs.existsSync("iscrizioni.json")){
      return res.json({
        totale:0,
        studio:0,
        corsi:0
      });
    }

    const rows = fs
      .readFileSync(
        "iscrizioni.json",
        "utf8"
      )
      .split("\n")
      .filter(Boolean)
      .map(r => JSON.parse(r));

    res.json({

      totale: rows.length,

      studio:
        rows.filter(
          r => r.destinazione === "studio"
        ).length,

      corsi:
        rows.filter(
          r => r.destinazione === "corsi"
        ).length,

      da_importare:
        rows.filter(
          r =>
            r.stato_importazione ===
            "da_importare"
        ).length

    });
  }
});
/* ===============================
SERVER
================================ */

const PORT = process.env.PORT || 3000

app.listen(PORT, ()=>{
  console.log("Server attivo su porta", PORT)
})
