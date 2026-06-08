import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

for (const path of [
  "infra/oracle/terraform/main.tf",
  "infra/oracle/terraform/variables.tf",
  "infra/oracle/terraform/outputs.tf",
  "infra/oracle/terraform/cloud-init.yaml.tftpl",
  "infra/oracle/terraform/terraform.tfvars.example",
  "infra/oracle/terraform/README.md",
]) {
  assert.equal(existsSync(new URL(`../../${path}`, import.meta.url)), true, `${path} should exist`);
}

const main = read("infra/oracle/terraform/main.tf");
assert.match(main, /required_providers/);
assert.match(main, /oracle\/oci/);
assert.match(main, /oci_core_vcn/);
assert.match(main, /oci_core_subnet/);
assert.match(main, /oci_core_internet_gateway/);
assert.match(main, /oci_core_route_table/);
assert.match(main, /oci_core_security_list/);
assert.match(main, /shape\s*=\s*var\.instance_shape/);
assert.match(main, /oci_core_instance/);
assert.match(main, /cloud-init\.yaml\.tftpl/);
assert.match(main, /source_details/);
assert.match(main, /metadata/);
assert.match(main, /ssh_authorized_keys/);

for (const port of ["22", "80", "443"]) {
  assert.match(main, new RegExp(`min\\s*=\\s*${port}\\s+max\\s*=\\s*${port}`));
}

const variables = read("infra/oracle/terraform/variables.tf");
assert.match(variables, /default\s*=\s*"VM\.Standard\.A1\.Flex"/);
for (const variable of [
  "tenancy_ocid",
  "user_ocid",
  "fingerprint",
  "private_key_path",
  "region",
  "compartment_ocid",
  "availability_domain",
  "image_ocid",
  "ssh_public_key",
  "repo_url",
  "app_domain",
]) {
  assert.match(variables, new RegExp(`variable "${variable}"`));
}

const outputs = read("infra/oracle/terraform/outputs.tf");
assert.match(outputs, /public_ip/);
assert.match(outputs, /ssh_command/);
assert.match(outputs, /app_url/);

const cloudInit = read("infra/oracle/terraform/cloud-init.yaml.tftpl");
assert.match(cloudInit, /#cloud-config/);
assert.match(cloudInit, /get\.docker\.com/);
assert.match(cloudInit, /git clone/);
assert.match(cloudInit, /deploy\/oracle\/bootstrap-ubuntu\.sh/);
assert.match(cloudInit, /repo_url/);

const tfvars = read("infra/oracle/terraform/terraform.tfvars.example");
assert.match(tfvars, /VM\.Standard\.A1\.Flex/);
assert.match(tfvars, /repo_url/);
assert.match(tfvars, /app_domain/);

const readme = read("infra/oracle/terraform/README.md");
assert.match(readme, /terraform init/);
assert.match(readme, /terraform apply/);
assert.match(readme, /terraform output ssh_command/);
assert.match(readme, /bash deploy\/oracle\/deploy\.sh/);

console.log("oracle terraform checks passed");
