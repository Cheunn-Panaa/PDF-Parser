/**
 * PDF extract globals
 */
const PDFExtract = require('pdf.js-extract').PDFExtract
const pdfExtract = new PDFExtract()

/**
 * Request globals
 */
const fs = require('fs')
const request = require('request-promise-native')
const urlPdf = "https://transformation-digitale.info/media/aaoun/EDT/EDT_STRI2A_M1RT.pdf"

/**
 * Personnal globals
 */
const Semaine = require('./../classes/semaine.js')

const redNode = "\x1b[31m"
const blueNode = "\x1b[36m"
const resetNode = "\x1b[0m"

module.exports = class ExtractDatasPDF{

    static async extract(){
        let semaines = new Array()

        //On récupère la version du pdf actuel
        //const prevVersion = await getVersion()

        await downloadPDF(urlPdf, "EDT.pdf")
        console.log(blueNode, "PDF Downloaded", resetNode)
        
        //On récupère la nouvelle version du pdf
        //const lastVersion = await getVersion()

        await extractDatas(semaines)
        console.log(blueNode, "Datas Extracted", resetNode)

        return semaines
    }

}

async function getVersion(){
    let data
    try{
        data = await pdfExtract.extract("EDT.pdf", {})
    }catch (err){
        console.log(err)
    }
    return data.meta.info.CreationDate
}

async function downloadPDF(pdfURL, outputFilename) {
    let pdfBuffer = await request.get({uri: pdfURL, encoding: null})
    fs.writeFileSync(outputFilename, pdfBuffer)
}

async function extractDatas(semaines){
    let data
    try{
        data = await pdfExtract.extract("EDT.pdf", {})
    }catch (err){
        console.log(err)
    }

    for await(const element of data.pages[0].content){
        if(element.x < 65){ //Titre d'une semaine
            //On initialise notre semaine
            const regex = RegExp("U[1-4]/*")
            let debutLigne = 0
            let semaine = new Semaine(element.str)

            for await(const elem of data.pages[0].content){
                //On reboucle pour chercher les infos utiles a notre semaine
                if(elem.y >= element.y-1 && elem.y <= element.y+85){
                    if(elem.x > 104 && elem.fontName == "g_d0_f6"){ //Cours ou Lieu dans le tableau

                        if(elem.y - debutLigne >= 18){ //On est passé a une nouvelle ligne
                            semaine.addJour(elem.y)
                            debutLigne = elem.y
                        }

                        if(regex.test(elem.str.slice(0,2)) || elem.str == "Amphi"){ //Ajout du lieu
                            if(semaine.getJourEntreCoord(elem.y) && semaine.getJourEntreCoord(elem.y).getCoursEntreCoord(elem.x, elem.y)){
                                let coursModif = semaine.getJourEntreCoord(elem.y).getCoursEntreCoord(elem.x, elem.y)
                                if(coursModif.getLieu() == ""){
                                    coursModif.setLieu(elem.str)
                                    coursModif.setEndOfCase(elem.x + elem.width)

                                    if(coursModif.getStartCoordY()-1 < elem.y && coursModif.getStartCoordY()+1 > elem.y){ //Cours et lieu sur la meme coordY
                                        if(semaine.getJourEntreCoord(elem.y).getStartCoordY()+5 > coursModif.getStartCoordY()){
                                            coursModif.setCoursIng(true)
                                            if(semaine.getJourEntreCoord(elem.y).getOtherCoursParDebut(coursModif)){
                                                semaine.getJourEntreCoord(elem.y).getOtherCoursParDebut(coursModif).setCoursAlt(true)
                                            }
                                        }else{
                                            coursModif.setCoursAlt(true)
                                            if(semaine.getJourEntreCoord(elem.y).getOtherCoursParDebut(coursModif)){
                                                semaine.getJourEntreCoord(elem.y).getOtherCoursParDebut(coursModif).setCoursIng(true)
                                            }
                                        }
                                    }
                                }else{
                                    console.log(redNode, "/!\\ WARNING - Lieu : " + elem.str, resetNode)
                                    console.log(elem)
                                }
                            }else{
                                console.log(redNode, "/!\\ WARNING - Lieu : " + elem.str, resetNode)
                                console.log(elem)
                            }

                        }else{ //Création du cours
                            if(semaine.getDernierJour().getDernierCours() && semaine.getDernierJour().getDernierCours().getNextCoordX() == 1000000){
                                semaine.getDernierJour().getDernierCours().setNextCoordX(elem.x)
                            }
                            semaine.getDernierJour().addCours(elem.str, elem.x, elem.y, elem.width, elem.height)
                        }
                    }

                    if(elem.x > 104 && elem.fontName == "g_d0_f7"){ //Prof dans le tableau
                        if(semaine.getDernierJour() && semaine.getDernierJour().getCoursParDebut(elem.x)){
                            let coursModif = semaine.getDernierJour().getCoursParDebut(elem.x)
                            coursModif.setProf(elem.str)
                            coursModif.setCoursIng(false)
                            coursModif.setCoursAlt(false)
                        }else{
                            console.log(redNode, "/!\\ WARNING - Prof : " + elem.str, resetNode)
                            console.log(elem)
                        }
                    }
                }
            }
            //On ajoute la semaine a notre liste de semaines
            await semaines.push(semaine)
        }
    }
}