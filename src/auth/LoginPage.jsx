import { useState } from "react";

export default function LoginPage({ onLogin }) {

const [email,setEmail] = useState("");
const [password,setPassword] = useState("");

function login(){

if(!email || !password){
alert("Enter email and password");
return;
}

onLogin({
id:email,
email
});

}

return (

<div className="card">

<h2>Theraa Nurse Login</h2>

<input
className="input"
placeholder="Email"
value={email}
onChange={(e)=>setEmail(e.target.value)}
/>

<input
className="input"
type="password"
placeholder="Password"
value={password}
onChange={(e)=>setPassword(e.target.value)}
/>

<button className="btn-primary" onClick={login}>
Login
</button>

</div>

)

}