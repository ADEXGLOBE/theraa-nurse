export async function analyseSession(note){

const response = await fetch("/api/analyse-session",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({note})

})

return await response.json()

}