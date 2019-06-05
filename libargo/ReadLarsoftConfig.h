#ifndef READLASRSOFTCONFIG_H
#define READLASRSOFTCONFIG_H

#include "json.hpp"
class TFile;

void ReadLarsoftConfigAsJson(TFile* file);
void ReadLarsoftConfig(TFile* file, nlohmann::json& request); // request is IO.

#endif