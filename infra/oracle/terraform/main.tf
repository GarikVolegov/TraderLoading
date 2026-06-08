terraform {
  required_version = ">= 1.6.0"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 6.0"
    }
  }
}

provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

locals {
  freeform_tags = {
    app      = "traderloadings"
    deploy   = "oracle-always-free"
    managed  = "terraform"
  }
}

resource "oci_core_vcn" "traderloading" {
  compartment_id = var.compartment_ocid
  cidr_block     = var.vcn_cidr
  display_name   = "${var.project_name}-vcn"
  dns_label      = "traderload"
  freeform_tags  = local.freeform_tags
}

resource "oci_core_internet_gateway" "traderloading" {
  compartment_id = var.compartment_ocid
  display_name   = "${var.project_name}-igw"
  enabled        = true
  vcn_id         = oci_core_vcn.traderloading.id
  freeform_tags  = local.freeform_tags
}

resource "oci_core_route_table" "public" {
  compartment_id = var.compartment_ocid
  display_name   = "${var.project_name}-public-routes"
  vcn_id         = oci_core_vcn.traderloading.id
  freeform_tags  = local.freeform_tags

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.traderloading.id
  }
}

resource "oci_core_security_list" "public" {
  compartment_id = var.compartment_ocid
  display_name   = "${var.project_name}-public-security"
  vcn_id         = oci_core_vcn.traderloading.id
  freeform_tags  = local.freeform_tags

  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }

  ingress_security_rules {
    protocol = "6"
    source   = var.ssh_cidr

    tcp_options {
      min = 22
      max = 22
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"

    tcp_options {
      min = 80
      max = 80
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"

    tcp_options {
      min = 443
      max = 443
    }
  }
}

resource "oci_core_subnet" "public" {
  cidr_block                 = var.subnet_cidr
  compartment_id             = var.compartment_ocid
  display_name               = "${var.project_name}-public-subnet"
  dns_label                  = "public"
  prohibit_public_ip_on_vnic = false
  route_table_id             = oci_core_route_table.public.id
  security_list_ids          = [oci_core_security_list.public.id]
  vcn_id                     = oci_core_vcn.traderloading.id
  freeform_tags              = local.freeform_tags
}

resource "oci_core_instance" "app" {
  availability_domain = var.availability_domain
  compartment_id      = var.compartment_ocid
  display_name        = "${var.project_name}-app"
  shape               = var.instance_shape
  freeform_tags       = local.freeform_tags

  shape_config {
    ocpus         = var.ocpus
    memory_in_gbs = var.memory_in_gbs
  }

  create_vnic_details {
    assign_public_ip = true
    display_name     = "${var.project_name}-vnic"
    hostname_label   = "app"
    subnet_id        = oci_core_subnet.public.id
  }

  source_details {
    source_id   = var.image_ocid
    source_type = "image"
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data = base64encode(templatefile("${path.module}/cloud-init.yaml.tftpl", {
      repo_url   = var.repo_url
      app_domain = var.app_domain
    }))
  }
}
