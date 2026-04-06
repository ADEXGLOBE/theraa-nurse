import { supabase } from "./supabaseClient"

export async function getPatientsForUser(userId){

const { data, error } = await supabase
.from("assignments")
.select(`
patients(
id,
name,
age,
ndis_number
)
`)
.eq("user_id",userId)

if(error){
console.error(error)
return []
}

return data.map(a => a.patients)

}