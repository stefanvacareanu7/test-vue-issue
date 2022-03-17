# typed: true
# frozen_string_literal: true

# rubocop:disable Style/ColonMethodCall
class File::ConvertService < ApplicationService
  sig {
    params(
      input_file: T.any(File, Tempfile),
      output_file: T.any(File, Tempfile),
      output_format: Symbol,
    ).returns(T.any(File, Tempfile))
  }
  def self.run(input_file:, output_file:, output_format:)
    # loading Aspose through RJB is done here rather than an initializer
    # because, when `Rjb:load` is run on Rails initialization, it has a
    # side-effect causng a subsequent Compare call to segfault on a
    # HTTPParty.post request, due to an exception in getsocketaddr (seems
    # to only come up in Ruby 3.x)
    load_aspose

    document = Rjb::import("com.aspose.words.Document").new(input_file.path)
    _options = aspose_save_options(output_format)
    document.save(output_file.path)

    output_file
  end

  sig { params(output_format: Symbol).returns(T.untyped) }
  def self.aspose_save_options(output_format)
    save_formats = Rjb::import("com.aspose.words.SaveFormat")

    case output_format
    when :docx
      Rjb::import("com.aspose.words.OoxmlSaveOptions").new(save_formats.DOCX)
    when :doc
      Rjb::import("com.aspose.words.DocSaveOptions").new(save_formats.DOC)
    when :html
      save_options =
        Rjb::import("com.aspose.words.HtmlSaveOptions").new(save_formats.HTML)
      save_options.setExportRoundtripInformation(true)
      save_options
    else
      raise "Unknown output file format"
    end
  end

  def self.load_aspose
    Rjb.load(
      Rails.root.join("vendor/aspose/aspose-words-22.2.0-jdk17.jar").to_s,
      ["-Djava.awt.headless=true"],
    )

    # read the license XML template and inject the signature from credentials
    license_template = File.read(
      Rails.root.join("vendor/aspose/Aspose.Words.Java.lic"),
    )

    license_tempfile = Tempfile.new
    license_text = license_template.sub(
      "{SIGNATURE}",
      Rails.application.credentials.aspose[:license_signature],
    )
    license_tempfile.write license_text
    license_tempfile.flush

    # set the license
    fstream = Rjb.import("java.io.FileInputStream").new(license_tempfile.path)
    license = Rjb.import("com.aspose.words.License").new
    license.setLicense(fstream)

    license_tempfile.close
  end
end
# rubocop:enable Style/ColonMethodCall
