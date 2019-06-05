// Framework includes
#include "art/Framework/Core/ModuleMacros.h"
#include "art/Framework/Core/EDAnalyzer.h"
#include "canvas/Persistency/Common/FindOneP.h"
#include "art/Framework/Principal/Event.h"
#include "art/Framework/Services/Optional/TFileService.h"
#include "fhiclcpp/ParameterSet.h"


// LArSoft Includes
#include "larcoreobj/SimpleTypesAndConstants/RawTypes.h" // raw::ChannelID_t
#include "larcore/Geometry/Geometry.h"


#include "ArgoGeoDumper_classes.h"
#include <iostream>
#include <algorithm>
#include "TTree.h"
#include "larcore/Geometry/Geometry.h"
#include "larcorealg/Geometry/CryostatGeo.h"

#include "json.hpp"
#include <fstream>
//
//

namespace agd{
class ArgoGeoDumper : public art::EDAnalyzer {
  
public:
  explicit ArgoGeoDumper(fhicl::ParameterSet const& pset); 
       
  void analyze(const art::Event&);
  void beginJob();
  void endJob();
  void reconfigure(fhicl::ParameterSet const& p);

protected:
  

  TTree* fTree;
  agd::wire_info* wire_info_ptr;
}; 


// ctor
ArgoGeoDumper::ArgoGeoDumper(fhicl::ParameterSet const& pset) : EDAnalyzer(pset)
{
  reconfigure(pset);
    
  art::ServiceHandle<art::TFileService> tfs;
  wire_info_ptr = new agd::wire_info;
  fTree = tfs->make<TTree>("wire","wire info");
  fTree->Branch("p","agd::wire_info",&wire_info_ptr);
}


void ArgoGeoDumper::reconfigure(fhicl::ParameterSet const& p)
{
 }


void ArgoGeoDumper::beginJob() 
{
 }

void ArgoGeoDumper::endJob()
{  
}



/////////////////////////////////////////////////
/// The meat //////


inline std::ostream& operator<< (std::ostream& out, const TVector3& v) {
   out << v.x() << "," << v.y() << "," << v.z();
   return out;
} // operator<< (CryostatID)


float r(double x)
{
  // round to sensible decimal place.
  return round(x*100000)/100000.0;
}


// jobstartend
void ArgoGeoDumper::analyze(const art::Event& )
{
  art::ServiceHandle<geo::Geometry> geom;
 
  using namespace geo;
  using nlohmann::json;
  
  const char* tab = "\t";

  // // iterate raw channel ids
  // for(raw::ChannelID_t chan = 0;chan<geom->Nchannels();chan++ ) {
  //   std::vector<geo::WireID> wids = geom->ChannelToWire(chan);
  //   for(geo::WireID wid: wids) {
  //     WireGeo const& geowire = geom->Wire(wid);
  //
  //     // std::cout << chan << "\t" << wid << std::endl;
  //   }
  // }
  
  agd::wire_info& entry = *wire_info_ptr;
  
  json all_wires;
  
  json jdoc;
  json jsections;
  json jtpcs;
  json plane_trans_offsets;


  // Find basis vectors.
  json jbasis;
  jbasis["along_vectors"] = json::array();
  jbasis["transverse_vectors"] = json::array();
  
  for(int iplane = 0;iplane<3;iplane++) {
    WireID wid(0,0,iplane,1); 
    const WireGeo& gwire = geom->Wire(wid);
    TVector3 along = gwire.Direction();
    if(along.Dot(TVector3(0,1,0))<0) along=-along; // Make sure they point 'up'.
    TVector3 transverse(0,-along.z(),along.y());
    if(transverse.Dot(TVector3(0,0,1))<0) transverse = -transverse;
    jbasis["along_vectors"].push_back({r(along.x()),r(along.y()),r(along.z())});
    jbasis["transverse_vectors"].push_back({r(transverse.x()),r(transverse.y()),r(transverse.z())});
    
  }
  // jbasis["along_vectors"].push()
  //   {0,1,0},
  //   {0,cos(angle),sin(angle)},
  //   {0,cos(angle),-sin(angle)}
  // };
  //
  //
  //
  // double angle = 35.710 * M_PI / 180.;
  //
  // // Wire directions.
  // TVector3 eu(0,cos(angle), sin(angle)); // "true" view 0
  // TVector3 ev(0,cos(angle),-sin(angle)); // "true" view 1
  //
  // // View transverse coordinates - the coordinate measured by the wire.
  // TVector3 ea(0,-sin(angle), cos(angle));
  // TVector3 eb(0, sin(angle), cos(angle));
  // TVector3 ez(0,0,1);
  //

  TVector3 ey(0,1,0);
  TVector3 eu(jbasis["along_vectors"][0][0],jbasis["along_vectors"][0][1],jbasis["along_vectors"][0][2]);
  TVector3 ev(jbasis["along_vectors"][1][0],jbasis["along_vectors"][1][1],jbasis["along_vectors"][1][2]);

  TVector3 ea(jbasis["transverse_vectors"][0][0],jbasis["transverse_vectors"][0][1],jbasis["transverse_vectors"][0][2]);
  TVector3 eb(jbasis["transverse_vectors"][1][0],jbasis["transverse_vectors"][1][1],jbasis["transverse_vectors"][1][2]);
  TVector3 ez(jbasis["transverse_vectors"][2][0],jbasis["transverse_vectors"][2][1],jbasis["transverse_vectors"][2][2]);
  
  // json jbasis;
  // jbasis["along_vectors"] = {
  //   {0,1,0},
  //   {0,cos(angle),sin(angle)},
  //   {0,cos(angle),-sin(angle)}
  // };
  // jbasis["transverse_vectors"] = {
  //   {0,0,1},
  //   {0,-sin(angle), cos(angle)},
  //   {0, sin(angle), cos(angle)}
  // };
  
  
  jdoc["basis"] = jbasis;
    
  
  int first_cid = 0;
  WireID first_wid;
  double first_trans=-1e9;
  for (geo::CryostatID const& cID: geom->IterateCryostatIDs()) {
    geo::CryostatGeo const& Cryo = geom->Cryostat(cID);
   
    for (geo::TPCGeo const& TPC: Cryo.TPCs()) { 
      
      
      entry.cryo = TPC.ID().Cryostat;
      entry.tpc  = TPC.ID().TPC;
      
      std::cout << "TPC" << TPC.ID() << std::endl;
      TVector3 tpcCenter(TPC.GetCenter().x(),TPC.GetCenter().y(),TPC.GetCenter().z());
      entry.tpcface[0] = tpcCenter.x();
      entry.tpcface[1] = tpcCenter.y();
      entry.tpcface[2] = tpcCenter.z();
      entry.tpctrans[0] = tpcCenter.Dot(ea);
      entry.tpctrans[1] = tpcCenter.Dot(eb);
      entry.tpctrans[2] = tpcCenter.Dot(ez);
      entry.tpchalfwidth[0] = TPC.HalfWidth();
      entry.tpchalfwidth[1] = TPC.HalfHeight();
      entry.tpchalfwidth[2] = TPC.HalfLength();
      

      json jtpc;
      jtpc["tpc"] = TPC.ID().TPC;

      // will revise these below.
      jtpc["center"] = {tpcCenter.x(), tpcCenter.y(), tpcCenter.z() };
      jtpc["transverse"] = {tpcCenter.Dot(ea),tpcCenter.Dot(eb),tpcCenter.Dot(ez)};
      jtpc["halfwidths"] = {TPC.ActiveHalfWidth(),TPC.ActiveHalfHeight(),TPC.ActiveHalfLength()};
      jtpc["drift_dir"]  = (TPC.DriftDir().x()>0)? 1 : -1;

      jtpc["views"] = json::array();
      double ymin = 1e19;
      double ymax = -1e19;
      double zmin = 1e19;
      double zmax = -1e19;
      
      
      
      for(size_t iplane =0; iplane< TPC.Nplanes(); iplane++) {
        geo::PlaneGeo const& Plane = TPC.Plane(iplane);
        int view = Plane.View();
        std::cout << "Plane " << Plane.ID() << " view " <<view << std::endl;
        double pitch = Plane.WirePitch();

        // Which view is this?
        const WireGeo& gwire = geom->Wire(WireID(Plane.ID(),0));
        TVector3 vtrans(0,0,1); // Vertical wires measure Z
        TVector3 valong(0,1,0);
        int true_view = 2;
        if(iplane<2) {
          double dota = fabs(gwire.Direction().Dot(ea));
          double dotb = fabs(gwire.Direction().Dot(eb));
          if(dota<dotb) { vtrans = ea; valong = eu; true_view = 0;}
          else          { vtrans = eb; valong = ev; true_view = 1;}
        } 
        // Sanity check
        if( fabs(gwire.Direction().Dot(valong)) < 0.999 ) std::cout << "Error." << std::endl;
        if( fabs(gwire.Direction().Dot(vtrans)) > 0.001 ) std::cout << "Error." << std::endl;        

        plane_trans_offsets[iplane] = gwire.GetCenter().Dot(vtrans);

        json jtpc_view;
        const WireGeo& glastwire = geom->Wire(WireID(Plane.ID(),Plane.Nwires()-1));
        double trans_first_wire =gwire.GetCenter().Dot(vtrans);
        double trans_last_wire  =glastwire.GetCenter().Dot(vtrans);

        jtpc_view["trans_direction"] = +1;
        jtpc_view["trans_offset"] = gwire.GetCenter().Dot(vtrans);
        jtpc_view["wire_pitch"] = pitch;
        jtpc_view["nwires"] = Plane.Nwires();
        jtpc_view["plane"] = Plane.ID().Plane;
        jtpc_view["x"] = gwire.GetCenter().x();
        if(trans_last_wire < trans_first_wire) jtpc_view["trans_direction"] = -1;
        jtpc_view["sections"] = json::array();

        bool first = true;

        for(size_t iwire = 0; iwire < Plane.Nwires(); iwire++) {
          WireGeo const& gwire = Plane.Wire(iwire);
          WireID wid(Plane.ID(),iwire);
          raw::ChannelID_t cid = geom->PlaneWireToChannel(wid);
          
          
          json wire_data;
          wire_data["channel"] = cid;
          wire_data["plane"] = wid.Plane;
          wire_data["wire"] = wid.Wire;
          wire_data["tpc"] = wid.TPC;
          wire_data["pitch"] = Plane.WirePitch();
          wire_data["direction"] = {gwire.Direction().x(),gwire.Direction().y(),gwire.Direction().z()};
          wire_data["halflength"] = gwire.HalfL();
          wire_data["center"]   =  {gwire.GetCenter().x(),gwire.GetCenter().y(),gwire.GetCenter().z()};
          wire_data["end1"]     =  {gwire.GetStart().x(),gwire.GetStart().y(),gwire.GetStart().z()};
          wire_data["end2"]     =  {gwire.GetEnd().x(),gwire.GetEnd().y(),gwire.GetEnd().z()};
          wire_data["vtrans"]   =  {vtrans.x(),vtrans.y(),vtrans.z()};
          wire_data["view"]     =  true_view;
          wire_data["larsoft_view"] =  view;

          all_wires.push_back(wire_data);

          if(gwire.GetStart().y() < ymin) ymin = gwire.GetStart().y();
          if(gwire.GetStart().y() > ymax) ymax = gwire.GetStart().y();
          if(gwire.GetStart().z() < zmin) zmin = gwire.GetStart().z();
          if(gwire.GetStart().z() > zmax) zmax = gwire.GetStart().z();

          double transverse = gwire.GetCenter().Dot(vtrans);

          entry.plane = wid.Plane;
          entry.view  = true_view;
          entry.larsoft_view = view;
          entry.wire  = wid.Wire;
          entry.wiredir[0] = gwire.Direction().x();
          entry.wiredir[1] = gwire.Direction().y();
          entry.wiredir[2] = gwire.Direction().z();
          entry.transdir[0] = vtrans.x();
          entry.transdir[1] = vtrans.y();
          entry.transdir[2] = vtrans.z();
          entry.wirecenter[0] = gwire.GetCenter().x();
          entry.wirecenter[1] = gwire.GetCenter().y();
          entry.wirecenter[2] = gwire.GetCenter().z();
          entry.end1[0] = gwire.GetStart().x();
          entry.end1[1] = gwire.GetStart().y();
          entry.end1[2] = gwire.GetStart().z();
          entry.end2[0] = gwire.GetEnd().x();
          entry.end2[1] = gwire.GetEnd().y();
          entry.end2[2] = gwire.GetEnd().z();
          entry.pitch = pitch;
          entry.trans = gwire.GetCenter().Dot(vtrans);
          entry.along = gwire.GetCenter().Dot(valong);
          entry.halflength = gwire.HalfL();
          fTree->Fill();

          std::cout << wid << tab << cid << tab << valong.Dot(gwire.Direction()) << tab << vtrans.Dot(gwire.Direction()) << std::endl;
            //<< transverse/pitch/iwire << tab << tpcCenter.Dot(transdirs[view]) <<  std::endl;

          // Is this the last wire of a contiguous readout block?
          bool last  = (iwire == Plane.Nwires()-1);
          if(!last) {
            raw::ChannelID_t next_cid = geom->PlaneWireToChannel(WireID(Plane.ID(),iwire+1));
            if(next_cid-cid != 1) last = true;
          }

          if(first) {
            first = false;
            first_cid = cid;
            first_wid = wid;
            first_trans = transverse;
          } else if ( last  ) {
            std::cout << "Section" << std::endl;
            std::cout << tab << first_cid << tab << first_wid << std::endl;
            std::cout << tab << cid       << tab << wid  << std::endl; 
            json jsection;
            jsection[0]={
              {"channel",first_cid},
              {"tpc",first_wid.TPC},
              {"plane",first_wid.Plane},
              {"planewire",first_wid.Wire},
              {"trans",first_trans},
              {"view",true_view}
            };
            jsection[1]={
              {"channel",cid+1},
              {"tpc",wid.TPC},
              {"plane",wid.Plane},
              {"planewire",wid.Wire+1},
              {"trans",transverse+pitch},
              {"view",true_view}
            };
            jtpc_view["sections"].push_back(jsection);
            jsections.push_back(jsection);
            first = true;
          }
          
        }

        jtpc["views"][true_view] = jtpc_view;
        
      } // end plane
         
      // Revise the plane coordinates, using the actual wires.
      TVector3 wiresCenter(tpcCenter.x(),(ymin+ymax)/2., (zmin+zmax)/2. );
      jtpc["center"]    = {tpcCenter.x(), (ymin+ymax)/2., (zmin+zmax)/2. };
      jtpc["transverse"] = {wiresCenter.Dot(ea),wiresCenter.Dot(eb),wiresCenter.Dot(ez)};
      jtpc["halfwidths"] = {TPC.ActiveHalfWidth(),(ymax-ymin)/2.,(zmax-zmin)/2.};
      jtpc["drift_dir"]  = (TPC.DriftDir().x()>0)? 1 : -1;
      
      jtpcs[TPC.ID().TPC] = jtpc;      
    } // end tpc
  
  } // for all cryostats
  
  
  jdoc["plane_trans_offsets"] = plane_trans_offsets;
  // jdoc["readout_sections"] = jsections;
  jdoc["tpcs"] = jtpcs;
  
  std::ofstream fallwires("all_wires.json");
  fallwires << all_wires.dump(2);
  fallwires.close();
  
  std::ofstream fout("geo.json");
  fout << jdoc.dump(2);
  fout.close();
 
}
  
  



DEFINE_ART_MODULE(ArgoGeoDumper)

}