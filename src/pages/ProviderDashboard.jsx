import { useEffect,useState } from "react"
import { getPatientsForUser } from "../services/patientAccessService"

export default function ProviderDashboard({user}){

const [patients,setPatients] = useState([])

useEffect(()=>{

async function load(){

const data = await getPatientsForUser(user.id)
setPatients(data)

}

load()

},[user])

return (

<div className="zone-page">

<h2>Provider Dashboard</h2>

<div>Total Participants: {patients.length}</div>

<div className="card">

{patients.map(p => (

<div key={p.id}>

<p>{p.name}</p>

</div>

))}

</div>

</div>

)

}