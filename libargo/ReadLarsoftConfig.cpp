
#include "art/Framework/IO/Root/GetFileFormatEra.h"
#include "art/Framework/IO/Root/RootDB/SQLite3Wrapper.h"
#include "art/Framework/IO/Root/RootDB/tkeyvfs.h"
#include "canvas/Persistency/Provenance/FileFormatVersion.h"
#include "canvas/Persistency/Provenance/ParameterSetBlob.h"
#include "canvas/Persistency/Provenance/ParameterSetMap.h"
#include "canvas/Persistency/Provenance/rootNames.h"
#include "cetlib/container_algorithms.h"
#include "cetlib/exempt_ptr.h"
#include "fhiclcpp/ParameterSet.h"
#include "fhiclcpp/ParameterSetRegistry.h"
#include "fhiclcpp/ParameterSetWalker.h"
#include "fhiclcpp/make_ParameterSet.h"

#include "boost/program_options.hpp"
#include "boost/thread/shared_mutex.hpp"

#include "TFile.h"
#include "TTree.h"

extern "C" {
#include "sqlite3.h"
}

#include <cstddef>
#include <iomanip>
#include <iostream>
#include <memory>
#include <ostream>
#include <sstream>
#include <string>
#include <fstream>
#include <vector>
#include "Timer.h"

#include "ReadLarsoftConfig.h"


using art::ParameterSetBlob;
using art::ParameterSetMap;
using fhicl::ParameterSet;
using nlohmann::json;
using std::back_inserter;
using std::string;
using std::vector;


size_t
db_size(sqlite3* db)
{
  sqlite3_stmt* stmt;
  sqlite3_prepare_v2(db, "PRAGMA page_size;", -1, &stmt, nullptr);
  sqlite3_step(stmt);
  size_t page_size = sqlite3_column_int64(stmt, 0);
  sqlite3_finalize(stmt);
  sqlite3_prepare_v2(db, "PRAGMA page_count;", -1, &stmt, nullptr);
  sqlite3_step(stmt);
  size_t page_count = sqlite3_column_int64(stmt, 0);
  sqlite3_finalize(stmt);
  return page_size * page_count;
}

std::string
db_size_hr(sqlite3* db)
{
  std::string result;
  double size = db_size(db);
  std::vector<std::string> units = {"b", "KiB", "MiB", "GiB", "TiB"};
  auto unit = units.cbegin(), end = units.cend();
  while (size > 1024.0 && unit != end) {
    size /= 1024.0;
    ++unit;
  }
  std::ostringstream ss;
  ss << std::fixed << std::setprecision(1) << size << " " << *unit;
  result = ss.str();
  return result;
}


// Read all the ParameterSets stored in 'file'. Write any error messages
// to errors.  Return false on failure, and true on success.
bool
read_all_parameter_sets(TFile& file, std::ostream& errors)
{
  // This conflicts with the Gallery stuff.
  // ParameterSetMap psm;
  // ParameterSetMap* psm_address = &psm;
  // // Find the TTree that holds this data.
  // TTree* metadata_tree =
  //   static_cast<TTree*>(file.Get(art::rootNames::metaDataTreeName().c_str()));
  // if (!metadata_tree) {
  //   errors << "Unable to find the metadata tree in file '" << file.GetName()
  //          << "';\nthis may not be an ART event data file.\n";
  //   return false;
  // }
  // if (metadata_tree->GetBranch(
  //       art::rootNames::metaBranchRootName<ParameterSetMap>())) {
  //   metadata_tree->SetBranchAddress(
  //     art::rootNames::metaBranchRootName<ParameterSetMap>(), &psm_address);
  // }
  // art::FileFormatVersion ffv;
  // art::FileFormatVersion* ffv_address = &ffv;
  // metadata_tree->SetBranchAddress(
  //   art::rootNames::metaBranchRootName<art::FileFormatVersion>(), &ffv_address);
  // long bytes_read = metadata_tree->GetEntry(0);
  // if (bytes_read < 0) {
  //   errors << "Unable to read the metadata tree in file '" << file.GetName()
  //          << ";\nthis file appears to be corrupted.\n";
  //   return false;
  // }
  // // Check version
  // std::string const expected_era = art::getFileFormatEra();
  // if (ffv.era_ != expected_era) {
  //   errors << "Can only read files written during the \"" << expected_era
  //          << "\" era: "
  //          << "Era of "
  //          << "\"" << file.GetName() << "\" was "
  //          << (ffv.era_.empty() ? "not set" : ("set to \"" + ffv.era_ + "\" "))
  //          << ".\n";
  //   return false;
  // }
  // for (auto const& pr : psm) {
  //   // Read the next ParameterSet directly into the output vector.
  //   fhicl::ParameterSet pset;
  //   fhicl::make_ParameterSet(pr.second.pset_, pset);
  //   // fhicl::ParameterSetRegistry::put(pset);  No globals!
  // }
  // if (ffv.value_ >= 5) { // Should have metadata DB.
    // Open the DB
    art::SQLite3Wrapper sqliteDB(&file, "RootFileDB");

    // std::string exec_string = "SELECT name FROM sqlite_master  WHERE type='table' ORDER BY name;"; 
    // dump_sqlite(sqliteDB,exec_string);

    // dump_sqlite(sqliteDB,"select * from ParameterSets;");

    std::cout << "# Read SQLiteDB from file, total size: "
              << db_size_hr(sqliteDB) << ".\n"
              << std::endl;
    fhicl::ParameterSetRegistry::importFrom(sqliteDB);
    fhicl::ParameterSetRegistry::stageIn();
    std::cout << "Done." << std::endl;
//  }
  return true;
}

// Extract all the requested module configuration ParameterSets (for
// modules with the given labels, run as part of processes of the given
// names) from the given TFIle. An empty list of process names means
// select all process names; an empty list of module labels means select
// all modules. The ParameterSets are written to the stream output, and
// error messages are written to the stream errors.
//
// Returns 0 to indicate success, and 1 on failure.
// Precondition: file.IsZombie() == false

// Caution: We pass 'file' by non-const reference because the TFile interface
// does not declare the functions we use to be const, even though they do not
// modify the underlying file.


boost::mutex g_larsoft_fcl_mutex;

bool ReadLarsoftConfig_check(const ParameterSet& ps, nlohmann::json& conditions) 
{

  std::string keyvalue;
  for(json::iterator it2 = conditions.begin(); it2 != conditions.end(); ++it2) {
    json& condition = *it2;
    if( ! ps.get_if_present<string>(condition["key"],keyvalue) ) return false; // no key
    if(keyvalue != condition["value"]) return false; // key doesn't match.
  }
  // passed all tests.
  return true;
}  



using nlohmann::json;

class JsonWalker: public fhicl::ParameterSetWalker
{
public:
  nlohmann::json top;
  std::vector<nlohmann::json*> stack;
  nlohmann::json* jcur;
  JsonWalker() : top(json::object()) {jcur = &top;};

  virtual void enter_table(key_t const& k, any_t const&) {
    std::cout << "Start table " << k << std::endl;
    stack.push_back(jcur);
    if(jcur->is_array()) {
      jcur->push_back(json::object());
      jcur = &(jcur->back());
    } else {
      (*jcur)[k] = json::object();
      jcur = &((*jcur)[k]);
    }
  }
  virtual void exit_table(key_t const& k, any_t const& a) {
    std::cout << "End table "  << std::endl;
    jcur = stack.back();
    stack.pop_back();
  }
   virtual void enter_sequence(key_t const& k, any_t const&) {
    std::cout << "Start sequence " << k << std::endl;
    stack.push_back(jcur);
    if(jcur->is_array()) {
      jcur->push_back(json::array());
      jcur = &(jcur->back());
    } else {
      (*jcur)[k] = json::array();
      jcur = &((*jcur)[k]);
    }
  }
  virtual void exit_sequence(key_t const& k, any_t const& a) {
    std::cout << "End sequence " << k << std::endl;
    jcur = stack.back();
    stack.pop_back();
  }
  virtual void atom(key_t const& k, any_t const& a) {
    auto val =  boost::any_cast<std::string>(a);
    if(val.size() > 100) val = "...yadda yadda...";
    std::cout << "atom " << k << " -> " << val << std::endl;
    std::cout << jcur->dump(2) << std::endl;
    if(jcur->is_array()) {
      jcur->push_back(val);
    } else {
      (*jcur)[k] = val;
    }
  }

};

void ReadLarsoftConfigAsJson(TFile* file) 
{
  ///
  /// requests is of format
  /// requests: {
  ///      'shift_ticks': {conditions': [{ 'key': 'module_type', value: 'RawDigitFilterUBooNE'}], 'parameter': 'NumTicksToDropFront' } 
  ///  } 
  /// each request object gets a 'value'.

  // needs to be completely mutex locked! no other process allowed to run, since this idiot code uses a fucking singleton
  if(!file) return;
  // file->Print();
  boost::mutex::scoped_lock(g_larsoft_fcl_mutex);

  static bool initialized = false;
  if(!initialized) {
      tkeyvfs_init();
      initialized = true;
  }
  if(!file) return;
  std::ofstream devnull("");
  if (!read_all_parameter_sets(*file, devnull)) {
    return; 
  }
  
  auto const& collection = fhicl::ParameterSetRegistry::get();

  json jout;
  for (auto const& pr : collection) {
      auto const& ps = pr.second;
      JsonWalker jwalker;
      ps.walk(jwalker);
      jout.push_back(jwalker.top);
  }
  std::cout << jout.dump(2) << std::endl;

}

void ReadLarsoftConfig(TFile* file, nlohmann::json& requests)
{
  ///
  /// requests is of format
  /// requests: {
  ///      'shift_ticks': {conditions': [{ 'key': 'module_type', value: 'RawDigitFilterUBooNE'}], 'parameter': 'NumTicksToDropFront' } 
  ///  } 
  /// each request object gets a 'value'.

  // needs to be completely mutex locked! no other process allowed to run, since this idiot code uses a fucking singleton
  if(!file) return;
  file->Print();
  boost::mutex::scoped_lock(g_larsoft_fcl_mutex);

  static bool initialized = false;
  if(!initialized) {
      tkeyvfs_init();
      initialized = true;
  }
  if(!file) return;
  std::ofstream devnull("");
  if (!read_all_parameter_sets(*file, devnull)) {
    return; 
  }
  
  auto const& collection = fhicl::ParameterSetRegistry::get();

  // check against each request.
  for (json::iterator it = requests.begin(); it != requests.end(); ++it) {
      json& request = it.value();    
  
      json& conditions = request["conditions"];
      // iterate all results.
    
    // Cache pointers to the ParameterSets to avoid exorbitant copying.
    for (auto const& pr : collection) {
      auto const& ps = pr.second;
      if(ReadLarsoftConfig_check(ps,conditions)) {
        std::string value;
        if( ps.get_if_present<string>(request["parameter"],value)) {
          request["value"] = value;
        }
        break; // inner loop on collection
      }
    }
  }

}

