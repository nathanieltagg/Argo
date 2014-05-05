#include "RootToJson.h"
#include <TH1.h>
#include <TH2.h>
#include <TDirectory.h>


int findDivisor(int n, int m)
{
  // Have m bins, want n bins.
  // Find a divisor d such that
  // nd ~ m
  // and 
  // m%d = 0.
  for(int d=2;d<100;d++) {
    if(m%d) continue;
    if(m/d >= n) continue;
    return d;
  }
  return 1;
}

JsonElement getObjectInfo( TH1* hist )
{
  JsonElement j;
  TDirectory* dir = hist->GetDirectory();
  std::string name = hist->GetName();
  name += "_Info";
  if(!dir) return j;
  TNamed* info = dynamic_cast<TNamed*>(dir->Get(name.c_str()));
  if(!info) return j;
  j.setStr(info->GetTitle());
  return j;
}

JsonObject TH1ToHistogram( TH1* inHist, int maxbins )
{
  // Convert a histogram into a JSON file.
  JsonObject h;
  h.add("name" ,inHist->GetName());
  h.add("title",inHist->GetTitle());

  // Rebin if requested.
  TH1* hist = inHist;
  TH1* htemp = 0;
  if(maxbins && inHist->GetNbinsX() > maxbins) {
    int rebin = findDivisor(maxbins,inHist->GetNbinsX());
    htemp = inHist->Rebin(rebin,"htemp");
    hist = htemp;
    h.add("original_n",inHist->GetNbinsX());
    h.add("rebinned_x_by",rebin);
  }
  if(!hist) return h;
  h.add("classname",hist->ClassName());
  h.add("xlabel",hist->GetXaxis()->GetTitle());
  h.add("ylabel",hist->GetYaxis()->GetTitle());
  // Custom axis labels.
  if(hist->GetXaxis()->GetLabels()) {
    JsonArray binlabels;
    for(int i=1; i <= hist->GetNbinsX();i++) {
      binlabels.add(hist->GetXaxis()->GetBinLabel(i));
    }
    h.add("binlabelsx",binlabels);
  }
  h.add("n",hist->GetNbinsX());
  h.add("min",JsonElement(hist->GetXaxis()->GetXmin(),9));
  h.add("max",JsonElement(hist->GetXaxis()->GetXmax(),9));
  h.add("underflow",hist->GetBinContent(0));
  h.add("overflow",hist->GetBinContent(hist->GetNbinsX()+1));
  double stats[4];
  hist->GetStats(stats);
  h.add("total",JsonElement(stats[0],9));
  h.add("sum_x",JsonElement(stats[2],9));
  h.add("sum_x2",JsonElement(stats[3],9));
  h.add("max_content",JsonElement(hist->GetMaximum(),9));
  h.add("min_content",JsonElement(hist->GetMinimum(),9));
  h.add("time_on_x",hist->GetXaxis()->GetTimeDisplay());
  JsonArray data;
  JsonArray errs;
  // Does it have errors that aren't just simple sqrt(N)?
  bool has_err = (hist->GetSumw2()->fN>0);
  for(int i=1; i <= hist->GetNbinsX();i++) {
    data.add(JsonSigFig(hist->GetBinContent(i),3));
    errs.add(JsonSigFig(hist->GetBinError(i),3));
  }
  h.add("data",data);
  if(has_err) h.add("errs",errs);
  h.add("info",getObjectInfo(inHist));
  
  if(htemp) delete htemp;
  return h;
}


JsonObject TH2ToHistogram( TH2* inHist, int maxbins )
{
  JsonObject h;

  // Rebin if requested.
  TH2* hist = inHist;
  TH2* htemp = 0;
  if(maxbins && ((inHist->GetNbinsX() > maxbins) || (inHist->GetNbinsY() > maxbins))) {
    int rebinX = findDivisor(maxbins,inHist->GetNbinsX());
    int rebinY = findDivisor(maxbins,inHist->GetNbinsY());
    htemp = inHist->Rebin2D(rebinX,rebinY,"htemp");
    hist = htemp;
    h.add("original_n_x",inHist->GetNbinsX());
    h.add("original_n_y",inHist->GetNbinsY());
    h.add("rebinned_x_by",rebinX);
    h.add("rebinned_y_by",rebinY);
        
  }
  if(hist->GetXaxis()->GetLabels()) {
    JsonArray binlabels;
    for(int i=1; i <= hist->GetNbinsX();i++) {
      binlabels.add(hist->GetXaxis()->GetBinLabel(i));
    }
    h.add("binlabelsx",binlabels);
  }
  if(hist->GetYaxis()->GetLabels()) {
    JsonArray binlabels;
    for(int i=1; i <= hist->GetNbinsY();i++) {
      binlabels.add(hist->GetYaxis()->GetBinLabel(i));
    }
    h.add("binlabelsy",binlabels);
  }
 
  if(!hist) return h;
  h.add("classname",hist->ClassName());
  h.add("name" ,inHist->GetName());
  h.add("title",inHist->GetTitle());
  h.add("xlabel",hist->GetXaxis()->GetTitle());
  h.add("ylabel",hist->GetYaxis()->GetTitle());
  
  h.add("n_x",hist->GetNbinsX());
  h.add("min_x",hist->GetXaxis()->GetXmin());
  h.add("max_x",hist->GetXaxis()->GetXmax());
  h.add("n_y",hist->GetNbinsY());
  h.add("min_y",hist->GetYaxis()->GetXmin());
  h.add("max_y",hist->GetYaxis()->GetXmax());
  h.add("max_content",hist->GetMaximum());
  h.add("min_content",hist->GetMinimum());
  
  
  double stats[8];
  hist->GetStats(stats);
  h.add("total",JsonElement(stats[0],9));
  h.add("sum_x",JsonElement(stats[2],9));
  h.add("sum_x2",JsonElement(stats[3],9));
  h.add("sum_y",JsonElement(stats[6],9));
  h.add("sum_y2",JsonElement(stats[7],9));
  

  double tot = hist->GetSumOfWeights();
  h.add("total",tot);

  JsonArray errs;
  // Does it have errors that aren't just simple sqrt(N)?
  bool has_err = (hist->GetSumw2()->fN>0);

  JsonArray data;
  for(int i=1; i <= hist->GetNbinsX();i++) {
    JsonArray data2;
    JsonArray errs2;
    for(int j=1; j<= hist->GetNbinsY(); j++) {
      int bin = hist->GetBin(i,j);
      data2.add(JsonSigFig(hist->GetBinContent(bin),3));
      errs2.add(JsonSigFig(hist->GetBinError  (bin),3));
    }
    data.add(data2);
    errs.add(errs2);
  }
  h.add("data",data);
  if(has_err) h.add("errs",errs);
  h.add("info",getObjectInfo(inHist));
  
  if(htemp) delete htemp;
  return h;
}
