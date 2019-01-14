#include "RootToJson.h"
#include <TH1.h>
#include <TH2.h>
#include <TDirectory.h>
#include "json.hpp"
#include <iostream>
#include "json_tools.h"


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

nlohmann::json getObjectInfo( TH1* hist )
{
  nlohmann::json j;
  TDirectory* dir = hist->GetDirectory();
  std::string name = hist->GetName();
  name += "_Info";
  if(!dir) return j;
  TNamed* info = dynamic_cast<TNamed*>(dir->Get(name.c_str()));
  if(!info) return j;
  j = info->GetTitle();
  return j;
}

nlohmann::json TH1ToHistogram( TH1* inHist, int maxbins )
{
  nlohmann::json h;
  // Convert a histogram into a JSON file.
  h["name" ] = inHist->GetName();
  h["title"] = inHist->GetTitle();
 
  // Rebin if requested.
  TH1* hist = inHist;
  TH1* htemp = 0;
  if(maxbins && inHist->GetNbinsX() > maxbins) {
    int rebin = findDivisor(maxbins,inHist->GetNbinsX());
    htemp = inHist->Rebin(rebin,"htemp");
    hist = htemp;
    h["original_n"] = inHist->GetNbinsX();
    h["rebinned_x_by"] = rebin;
  }
  if(!hist) return h;
  h["classname"] = hist->ClassName();
  h["xlabel"] = hist->GetXaxis()->GetTitle();
  h["ylabel"] = hist->GetYaxis()->GetTitle();
  // Custom axis labels.
  if(hist->GetXaxis()->GetLabels()) {
    nlohmann::json binlabels;
    for(int i=1; i <= hist->GetNbinsX();i++) {
      binlabels.push_back(hist->GetXaxis()->GetBinLabel(i));
    }
    h["binlabelsx"] = binlabels;
  }
  // Custom bin widths
  if(hist->GetXaxis()->IsVariableBinSize()) {
    nlohmann::json xbins;
    const TArrayD* Xbins = hist->GetXaxis()->GetXbins();
    for(int bin=0;bin<hist->GetNbinsX();bin++) xbins.push_back(Xbins->At(bin));
    h["x_bins"] = xbins;
  } else {
    std::cout << hist->GetName() << " does not have variable bins" << std::endl;
    
  }
  
  h["n"] = hist->GetNbinsX();
  h["min"] = jsontool::fixed(hist->GetXaxis()->GetXmin(),10);
  h["max"] = jsontool::fixed(hist->GetXaxis()->GetXmax(),10);
  h["underflow"] = hist->GetBinContent(0);
  h["overflow"] = hist->GetBinContent(hist->GetNbinsX()+1);
  double stats[11];  // TProfile and TH2 each have 7 entries, TH3 has 11. Be safe: this caused an abort trap when called incorrectly.
  hist->GetStats(stats);
  h["total"] = jsontool::fixed(stats[0],9);
  h["sum_x"] = jsontool::fixed(stats[2],9);
  h["sum_x2"] = jsontool::fixed(stats[3],9);
  h["max_content"] = jsontool::fixed(hist->GetMaximum(),4);
  h["min_content"] = jsontool::fixed(hist->GetMinimum(),4);
  h["time_on_x"] = hist->GetXaxis()->GetTimeDisplay();
  nlohmann::json data;
  nlohmann::json errs;
  // Does it have errors that aren't just simple sqrt(N)?
  bool has_err = (hist->GetSumw2()->fN>0);
  double max_content_with_err = hist->GetMaximum();
  double min_content_with_err = hist->GetMaximum();
  for(int i=1; i <= hist->GetNbinsX();i++) {
    data.push_back(jsontool::sigfig(hist->GetBinContent(i),4));
    errs.push_back(jsontool::sigfig(hist->GetBinError(i),4));
    double ehigh = hist->GetBinContent(i)+hist->GetBinError(i);
    double elow  = hist->GetBinContent(i)-hist->GetBinError(i);
    if(ehigh> max_content_with_err) max_content_with_err = ehigh;
    if(elow < min_content_with_err) min_content_with_err = elow;
  }

  h["data"] = data;
  if(has_err) {
    h["errs"] = errs;
    h["min_content_with_err"] = jsontool::fixed(min_content_with_err,4);
    h["max_content_with_err"] = jsontool::fixed(max_content_with_err,4);
  }
  h["info"] = getObjectInfo(inHist);

  if(htemp) delete htemp;
  return h;
}


nlohmann::json TH2ToHistogram( TH2* inHist, int maxbins )
{
  nlohmann::json h;

  // Rebin if requested.
  TH2* hist = inHist;
  TH2* htemp = 0;
  if(maxbins && ((inHist->GetNbinsX() > maxbins) || (inHist->GetNbinsY() > maxbins))) {
    int rebinX = findDivisor(maxbins,inHist->GetNbinsX());
    int rebinY = findDivisor(maxbins,inHist->GetNbinsY());
    htemp = inHist->Rebin2D(rebinX,rebinY,"htemp");
    hist = htemp;
    h["original_n_x"] = inHist->GetNbinsX();
    h["original_n_y"] = inHist->GetNbinsY();
    h["rebinned_x_by"] = rebinX;
    h["rebinned_y_by"] = rebinY;
        
  }
  if(hist->GetXaxis()->GetLabels()) {
    nlohmann::json binlabels;
    for(int i=1; i <= hist->GetNbinsX();i++) {
      binlabels.push_back(hist->GetXaxis()->GetBinLabel(i));
    }
    h["binlabelsx"] = binlabels;
  }
  if(hist->GetYaxis()->GetLabels()) {
    nlohmann::json binlabels;
    for(int i=1; i <= hist->GetNbinsY();i++) {
      binlabels.push_back(hist->GetYaxis()->GetBinLabel(i));
    }
    h["binlabelsy"] = binlabels;
  }
 
  if(!hist) return h;
  h["classname"] = hist->ClassName();
  h["name" ] = inHist->GetName();
  h["title"] = inHist->GetTitle();
  h["xlabel"] = hist->GetXaxis()->GetTitle();
  h["ylabel"] = hist->GetYaxis()->GetTitle();
  
  h["n_x"] = hist->GetNbinsX();
  h["min_x"] = hist->GetXaxis()->GetXmin();
  h["max_x"] = hist->GetXaxis()->GetXmax();
  h["n_y"] = hist->GetNbinsY();
  h["min_y"] = hist->GetYaxis()->GetXmin();
  h["max_y"] = hist->GetYaxis()->GetXmax();
  h["max_content"] = hist->GetMaximum();
  h["min_content"] = hist->GetMinimum();
  
  
  double stats[8];
  hist->GetStats(stats);
  h["total"] = jsontool::fixed(stats[0],9);
  h["sum_x"] = jsontool::fixed(stats[2],9);
  h["sum_x2"] = jsontool::fixed(stats[3],9);
  h["sum_y"] = jsontool::fixed(stats[6],9);
  h["sum_y2"] = jsontool::fixed(stats[7],9);
  

  double tot = hist->GetSumOfWeights();
  h["total"] = tot;

  nlohmann::json errs;
  // Does it have errors that aren't just simple sqrt(N)?
  bool has_err = (hist->GetSumw2()->fN>0);

  int nx = hist->GetNbinsX();
  int ny = hist->GetNbinsY();
  nlohmann::json data;
  for(int i=1; i <= nx;i++) {
    nlohmann::json data2;
    nlohmann::json errs2;
    for(int j=1; j<= ny; j++) {
      int bin = hist->GetBin(i,j);
      data2.push_back(jsontool::sigfig(hist->GetBinContent(bin),3));
      errs2.push_back(jsontool::sigfig(hist->GetBinError  (bin),3));
    }
    data.push_back(data2);
    errs.push_back(errs2);
  }
  h["data"] =data;
  if(has_err) h["errs"] = errs;
  
  nlohmann::json underflow_x;
  nlohmann::json overflow_x;
  for(int j=1; j <= ny;j++)  {
    underflow_x.push_back(jsontool::sigfig(hist->GetBinContent(hist->GetBin(0,j)),3));
    overflow_x .push_back(jsontool::sigfig(hist->GetBinContent(hist->GetBin(0,nx+1)),3));
  }
  
  nlohmann::json overflow_y;
  nlohmann::json underflow_y;
  for(int i=1; i <= nx;i++)  {
    underflow_y.push_back(jsontool::sigfig(hist->GetBinContent(hist->GetBin(i,0)),3));
    overflow_y .push_back(jsontool::sigfig(hist->GetBinContent(hist->GetBin(i,ny+1)),3));
  }
  h["underflow_x"] = underflow_x;  
  h["overflow_x"] =  overflow_x;  
  h["underflow_y"] = underflow_y;  
  h["overflow_y"] =  overflow_y;  
  
  h["info"] = getObjectInfo(inHist);
  
  if(htemp) delete htemp;
  return h;
}
