variable "tenancy_ocid" {
  description = "Oracle Cloud tenancy OCID."
  type        = string
}

variable "user_ocid" {
  description = "Oracle Cloud user OCID for the API key."
  type        = string
}

variable "fingerprint" {
  description = "Fingerprint for the Oracle Cloud API key."
  type        = string
}

variable "private_key_path" {
  description = "Local path to the Oracle Cloud API private key."
  type        = string
}

variable "region" {
  description = "Oracle Cloud region, for example eu-frankfurt-1."
  type        = string
}

variable "compartment_ocid" {
  description = "Compartment OCID where resources will be created."
  type        = string
}

variable "availability_domain" {
  description = "Availability domain name for the Always Free instance."
  type        = string
}

variable "image_ocid" {
  description = "Ubuntu image OCID for the selected region."
  type        = string
}

variable "ssh_public_key" {
  description = "SSH public key content authorized for the ubuntu user."
  type        = string
}

variable "repo_url" {
  description = "Git repository URL cloned onto the VM."
  type        = string
}

variable "app_domain" {
  description = "Public app domain that will point to the VM public IP."
  type        = string
}

variable "project_name" {
  description = "Resource name prefix."
  type        = string
  default     = "traderloadings"
}

variable "instance_shape" {
  description = "Always Free Ampere shape."
  type        = string
  default     = "VM.Standard.A1.Flex"
}

variable "ocpus" {
  description = "A1 Flex OCPUs."
  type        = number
  default     = 1
}

variable "memory_in_gbs" {
  description = "A1 Flex RAM."
  type        = number
  default     = 6
}

variable "vcn_cidr" {
  description = "VCN CIDR block."
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_cidr" {
  description = "Public subnet CIDR block."
  type        = string
  default     = "10.0.1.0/24"
}

variable "ssh_cidr" {
  description = "CIDR allowed to SSH. Replace 0.0.0.0/0 with your IP for better security."
  type        = string
  default     = "0.0.0.0/0"
}
