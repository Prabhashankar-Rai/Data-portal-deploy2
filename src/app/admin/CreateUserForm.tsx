
// Admin form to create users with reporting line, branch, and source
"use client";
import { useState } from "react";

const reportingLines = [
	"Alternative Channel", "Branches", "Broking", "DBCC", "Inhouse & Strategic Alliance",
	"KL Agency", "MMIP", "NULL", "PAMB Affinity", "POS/Affinity", "Reinsurance"
];
const branches = [
	"Affinity & Partnership", "Agency", "Alor Setar", "Broking", "DBCC", "HO-AC",
	"Inhouse & Strategic Alliance", "Ipoh", "Johor Bahru", "KL Agencies", "KL/SEL", "Klang",
	"Kota Bahru", "Kota Kinabalu", "Kuantan", "Kuching", "Melaka", "MMIP", "NULL",
	"PAMB - HEAD OFFICE", "Penang", "Petaling Jaya", "Reinsurance Business", "Selangor",
	"Seremban", "Taiping", "Terengganu"
];
const sources = ["PIB", "PAMB"];

interface UserForm {
	email: string;
	name: string;
	password: string;
	reportingLine: string;
	branch: string;
	source: string;
}

export default function CreateUserForm() {
	const [form, setForm] = useState<UserForm>({
		email: "",
		name: "",
		password: "",
		reportingLine: "",
		branch: "",
		source: ""
	});
	const [message, setMessage] = useState("");

	const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		setForm({ ...form, [e.target.name]: e.target.value });
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage("");
		const res = await fetch("/api/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(form)
		});
		if (res.ok) setMessage("User created!");
		else setMessage("Error creating user");
	};

	return (
		<form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
			<input name="email" type="email" placeholder="Email" required value={form.email} onChange={handleChange} />
			<input name="name" type="text" placeholder="Name" required value={form.name} onChange={handleChange} />
			<input name="password" type="password" placeholder="Password" required value={form.password} onChange={handleChange} />
			<select name="reportingLine" required value={form.reportingLine} onChange={handleChange}>
				<option value="">Select Reporting Line</option>
				{reportingLines.map(r => <option key={r} value={r}>{r}</option>)}
			</select>
			<select name="branch" required value={form.branch} onChange={handleChange}>
				<option value="">Select Branch</option>
				{branches.map(b => <option key={b} value={b}>{b}</option>)}
			</select>
			<select name="source" required value={form.source} onChange={handleChange}>
				<option value="">Select Source</option>
				{sources.map(s => <option key={s} value={s}>{s}</option>)}
			</select>
			<button type="submit">Create User</button>
			{message && <div>{message}</div>}
		</form>
	);
}

