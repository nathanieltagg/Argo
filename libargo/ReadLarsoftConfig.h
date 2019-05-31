#ifndef READLASRSOFTCONFIG_H
#define READLASRSOFTCONFIG_H

#include "json.hpp"
class TFile;

void ReadLarsoftConfig(TFile* file, nlohmann::json& request); // request is IO.

#endif