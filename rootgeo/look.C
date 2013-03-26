int findIn(TGeoVolume* v, const char* name)
{
  TObjArray* arr = v->GetNodes();
  for(int i=0;i<arr->GetEntriesFast();i++) {
    TString s(arr->At(i)->GetName());
    if(s.BeginsWith(name)) return i;
  }
  return -1;
}


void look()
{
  TFile* f= new TFile("microboone.root");
  f->Get("Default");
  TGeoVolume* v = gGeoManager->GetTopVolume();
  v->Print();
  v = v->GetNode(findIn(v,"volDetEnclosure"))->GetVolume();
  v->Print();  
  v = v->GetNode(findIn(v,"volCryostat"))->GetVolume();
  v->Print();  
  v = v->GetNode(findIn(v,"volTPC"))->GetVolume();
  v->Print();  
  v = v->GetNode(findIn(v,"volTPCActive"))->GetVolume();
  v->Print();  
  v->GetShape()->Dump();
  
}
