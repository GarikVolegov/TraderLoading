output "public_ip" {
  description = "Public IP assigned to the app VM."
  value       = oci_core_instance.app.public_ip
}

output "ssh_command" {
  description = "SSH command for the Ubuntu VM."
  value       = "ssh ubuntu@${oci_core_instance.app.public_ip}"
}

output "app_url" {
  description = "Expected app URL after DNS points to public_ip and deploy completes."
  value       = "https://${var.app_domain}"
}
