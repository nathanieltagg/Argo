#ifndef READLASRSOFTCONFIG_H
#define READLASRSOFTCONFIG_H

#include "json.hpp"
class TFile;

void ReadLarsoftConfigAsJson(TFile* file);
void ReadLarsoftConfig(TFile* file, ntagg::json& request); // request is IO.

#endif